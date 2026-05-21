import { useEffect, useRef, useState, useCallback } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Maximize,
  Volume2,
  VolumeX,
  Gauge,
  Sliders,
  Repeat,
  ZoomIn,
  Lock,
  Unlock,
} from "lucide-react";
import { formatTime } from "@/lib/media-data";
import { useMediaStore } from "@/lib/media-store";

const SPEEDS = [0.5, 1, 1.25, 1.5, 2];

type VideoEl = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitDisplayingFullscreen?: boolean;
};

type HistoryItem = {
  id: string;
  title: string;
  thumb: string;
  duration: string;
  progress: number;
  lastPlayed: number;
};

export function VideoPlayer({
  src,
  onEnded,
  onPrev,
  onNext,
  onGestureStateChange,
  onControlsVisibilityChange,
}: {
  src: string;
  onEnded?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onGestureStateChange?: (swiping: boolean) => void;
  onControlsVisibilityChange?: (visible: boolean) => void;
}) {
  const { videos } = useMediaStore();
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const eqNodesRef = useRef<{ bass: BiquadFilterNode; mid: BiquadFilterNode; treble: BiquadFilterNode } | null>(null);
  
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [showSpeed, setShowSpeed] = useState(false);
  const [showEq, setShowEq] = useState(false);
  const [eq, setEq] = useState({ bass: 50, mid: 50, treble: 50 });
  const [brightness, setBrightness] = useState(100);
  const [volume, setVolume] = useState(1);
  const [overlay, setOverlay] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [looping, setLooping] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isSwipingActive, setIsSwipingActive] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<{ t: number; x: number } | null>(null);
  const pinchRef = useRef<{ distance: number; startZoom: number } | null>(null);
  
  const lastHistoryUpdateRef = useRef<number>(0);

  // Khas current video details track karne ke liye template tool
  const currentVideoData = videos.find(v => v.src === src || v.id === src || src.includes(v.id.replace("nv-", "")));

  // 👑 FIXED: currentVideoData ko ref mein store kiya taaki iski wajah se player baar-baar re-render ya reset na ho
  const currentVideoDataRef = useRef(currentVideoData);
  useEffect(() => {
    currentVideoDataRef.current = currentVideoData;
  }, [currentVideoData]);

  const flashOverlay = useCallback((text: string, ms = 900) => {
    setOverlay(text);
    window.setTimeout(() => setOverlay(null), ms);
  }, []);

  const armHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setShowControls(false);
      setShowSpeed(false);
      setShowEq(false);
    }, 2500);
  }, []);

  const reveal = useCallback(() => {
    setShowControls(true);
    armHide();
  }, [armHide]);

  useEffect(() => {
    const visibleState = showControls && !isSwipingActive && !isLocked;
    onControlsVisibilityChange?.(visibleState);
  }, [showControls, isSwipingActive, isLocked, onControlsVisibilityChange]);

  useEffect(() => {
    armHide();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [armHide]);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setExpanded(false);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const pB = document.body.style.overflow;
    const pH = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = pB;
      document.documentElement.style.overflow = pH;
    };
  }, [expanded]);

  // 👑 FIXED: dependency array se currentVideoData ko hataya taaki video chaltiyen loop na mare
  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
    setMuted(false);
    setVolume(1);
    setSpeed(1);
    setShowEq(false);
    setShowSpeed(false);
    setZoom(1);
    setIsSwipingActive(false);
    setIsLocked(false);
    lastHistoryUpdateRef.current = 0; 
    const v = videoRef.current;
    if (!v) return;
    
    let savedTime = 0;
    const activeVideo = currentVideoDataRef.current;

    try {
      const raw = localStorage.getItem("zabplay_watching_history");
      if (raw && activeVideo) {
        const parsed: HistoryItem[] = JSON.parse(raw);
        const match = parsed.find(h => h.id === activeVideo.id);
        if (match) {
          const parts = match.duration.split(':').map(Number);
          const totalSec = parts.length === 2 ? parts[0] * 60 + parts[1] : 0;
          if (totalSec > 0) {
            savedTime = (match.progress / 100) * totalSec;
          }
        }
      }
    } catch {
      const oldSaved = localStorage.getItem(`history_${src}`);
      if (oldSaved) savedTime = parseFloat(oldSaved);
    }

    v.currentTime = savedTime;
    v.playbackRate = 1;
    v.muted = false;
    v.volume = 1;
    v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [src]); // <-- Khali src par chalega, isliye naye video par hi reset hoga!

  useEffect(() => {
    if (videoRef.current) videoRef.current.loop = looping;
  }, [looping]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    
    const onTime = () => {
      const currentTimeVal = v.currentTime;
      setCurrent(currentTimeVal);

      const now = Date.now();
      if (now - lastHistoryUpdateRef.current < 1000) return;
      lastHistoryUpdateRef.current = now;

      localStorage.setItem(`history_${src}`, currentTimeVal.toString());

      const activeVideo = currentVideoDataRef.current;
      if (activeVideo && v.duration > 0) {
        try {
          const pctCalculated = (currentTimeVal / v.duration) * 100;
          const currentDurationStr = formatTime(v.duration);
          
          const raw = localStorage.getItem("zabplay_watching_history");
          let historyList: HistoryItem[] = raw ? JSON.parse(raw) : [];
          
          historyList = historyList.filter(h => h.id !== activeVideo.id);
          
          const updatedItem: HistoryItem = {
            id: activeVideo.id,
            title: activeVideo.title,
            thumb: activeVideo.thumb,
            duration: currentDurationStr,
            progress: Math.min(Math.max(pctCalculated, 0), 100),
            lastPlayed: now
          };
          
          historyList.unshift(updatedItem);
          if (historyList.length > 20) historyList.pop();
          
          localStorage.setItem("zabplay_watching_history", JSON.stringify(historyList));
        } catch (err) {
          console.error("Failed writing complex storage history matrix", err);
        }
      }
    };

    const onMeta = () => setDuration(v.duration);
    
    const onEnd = () => {
      setPlaying(false);
      localStorage.removeItem(`history_${src}`);
      
      const activeVideo = currentVideoDataRef.current;
      if (activeVideo) {
        try {
          const raw = localStorage.getItem("zabplay_watching_history");
          if (raw) {
            let historyList: HistoryItem[] = JSON.parse(raw);
            historyList = historyList.filter(h => h.id !== activeVideo.id);
            localStorage.setItem("zabplay_watching_history", JSON.stringify(historyList));
          }
        } catch {}
      }

      if (!looping) onEnded?.();
    };

    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("ended", onEnd);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("ended", onEnd);
    };
  }, [looping, onEnded, src]);

  const ensureAudioGraph = useCallback(() => {
    const v = videoRef.current;
    if (!v || sourceRef.current) return;
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      const source = ctx.createMediaElementSource(v);
      const bass = ctx.createBiquadFilter(); bass.type = "lowshelf"; bass.frequency.value = 200;
      const mid = ctx.createBiquadFilter(); mid.type = "peaking"; mid.frequency.value = 1000; mid.Q.value = 1;
      const treble = ctx.createBiquadFilter(); treble.type = "highshelf"; treble.frequency.value = 3000;
      source.connect(bass).connect(mid).connect(treble).connect(ctx.destination);
      audioCtxRef.current = ctx; sourceRef.current = source; eqNodesRef.current = { bass, mid, treble };
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const nodes = eqNodesRef.current;
    if (!nodes) return;
    const toDb = (val: number) => ((val - 50) / 50) * 12;
    nodes.bass.gain.value = toDb(eq.bass);
    nodes.mid.gain.value = toDb(eq.mid);
    nodes.treble.gain.value = toDb(eq.treble);
  }, [eq]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    audioCtxRef.current?.resume();
    if (v.paused) { v.play().catch(() => {}); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
    reveal();
  };

  const seekBy = (delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    const next = Math.max(0, Math.min((v.duration || 0), v.currentTime + delta));
    v.currentTime = next;
    setCurrent(next);
    setOverlay(`${delta > 0 ? "+" : ""}${Math.round(delta)}s`);
    setTimeout(() => setOverlay(null), 600);
  };

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const t = (parseFloat(e.target.value) / 100) * (v.duration || 0);
    v.currentTime = t;
    setCurrent(t);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    if (!v.muted && v.volume === 0) { v.volume = 1; setVolume(1); }
    setMuted(v.muted);
    flashOverlay(v.muted ? "Muted" : `Volume ${Math.round(v.volume * 100)}%`);
    reveal();
  };

  const toggleFullscreen = () => {
    const el = wrapRef.current;
    const v = videoRef.current as VideoEl | null;
    if (!el || !v) return;
    if (document.fullscreenElement === el || expanded) {
      if (document.fullscreenElement === el) document.exitFullscreen?.().catch(() => setExpanded(false));
      else setExpanded(false);
      flashOverlay("Mini player"); reveal(); return;
    }
    const lockLandscape = async () => {
      try { await (screen.orientation as any).lock?.("landscape"); } catch { /* ignore */ }
    };
    if (el.requestFullscreen) el.requestFullscreen().then(lockLandscape).catch(() => setExpanded(true));
    else if (v.webkitEnterFullscreen) { try { v.webkitEnterFullscreen(); } catch { setExpanded(true); } }
    else setExpanded(true);
    flashOverlay("Fullscreen"); reveal();
  };

  const cycleZoom = () => {
    const levels = [1, 1.25, 1.5, 2];
    const currentIndex = levels.findIndex((level) => Math.abs(level - zoom) < 0.01);
    const next = levels[(currentIndex + 1) % levels.length];
    setZoom(next); flashOverlay(`Zoom ${Math.round(next * 100)}%`); reveal();
  };

  const toggleLoop = () => {
    setLooping((p) => { const n = !p; flashOverlay(n ? "Loop on" : "Loop off"); return n; });
    reveal();
  };

  const setSpeedVal = (s: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = s;
    setSpeed(s); setShowSpeed(false); flashOverlay(`Speed ${s}x`); reveal();
  };

  const gesture = useRef<{ x: number; y: number; side: "L" | "R"; mode: "" | "v" | "h"; startVol: number; startBri: number; startTime: number; width: number } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    if (isLocked) return;
    const t = e.touches[0];
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    gesture.current = {
      x: t.clientX, y: t.clientY,
      side: t.clientX - rect.left < rect.width / 2 ? "L" : "R",
      mode: "", startVol: volume, startBri: brightness,
      startTime: videoRef.current?.currentTime ?? 0, width: rect.width,
    };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (isLocked) return;
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (!pinchRef.current) { pinchRef.current = { distance, startZoom: zoom }; } 
      else {
        const next = Math.max(1, Math.min(3, pinchRef.current.startZoom * (distance / pinchRef.current.distance)));
        setZoom(next); setOverlay(`Zoom ${Math.round(next * 100)}%`);
      }
      return;
    }
    const g = gesture.current; if (!g) return;
    const t = e.touches[0]; const dx = t.clientX - g.x; const dy = t.clientY - g.y;
    if (g.mode === "") {
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
      g.mode = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      setIsSwipingActive(true); onGestureStateChange?.(true);
    }
    const v = videoRef.current; if (!v) return;
    if (g.mode === "h") {
      const seekDelta = (dx / g.width) * 60;
      const next = Math.max(0, Math.min(v.duration || 0, g.startTime + seekDelta));
      setOverlay(`${seekDelta >= 0 ? "+" : ""}${Math.round(seekDelta)}s  ${formatTime(next)}`);
      setCurrent(next); return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const ratio = -dy / rect.height;
    if (g.side === "R") {
      const nv = Math.max(0, Math.min(1, g.startVol + ratio)); v.volume = nv; setVolume(nv); setOverlay(`Volume ${Math.round(nv * 100)}%`);
    } else {
      const nb = Math.max(20, Math.min(150, g.startBri + ratio * 100)); setBrightness(nb); setOverlay(`Brightness ${Math.round(nb)}%`);
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    setIsSwipingActive(false); onGestureStateChange?.(false);
    if (pinchRef.current) { pinchRef.current = null; setTimeout(() => setOverlay(null), 600); armHide(); return; }
    const g = gesture.current;
    if (g && g.mode === "h") {
      const v = videoRef.current; const last = e.changedTouches[0];
      if (v && last) {
        const dx = last.clientX - g.x; const seekDelta = (dx / g.width) * 60;
        const next = Math.max(0, Math.min(v.duration || 0, g.startTime + seekDelta));
        v.currentTime = next; setCurrent(next);
      }
      gesture.current = null; setTimeout(() => setOverlay(null), 600); armHide(); return;
    }
    if (g && g.mode === "") {
      const now = Date.now();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = (e.changedTouches[0]?.clientX ?? g.x) - rect.left;
      if (!showControls || isLocked) { setShowControls(true); armHide(); lastTapRef.current = null; gesture.current = null; return; }
      if (lastTapRef.current && now - lastTapRef.current.t < 300) {
        const sameSide = (lastTapRef.current.x < rect.width / 2 && x < rect.width / 2) || (lastTapRef.current.x >= rect.width / 2 && x >= rect.width / 2);
        if (sameSide) { seekBy(x >= rect.width / 2 ? 10 : -10); lastTapRef.current = null; gesture.current = null; armHide(); return; }
      }
      lastTapRef.current = { t: now, x };
    }
    gesture.current = null; setTimeout(() => setOverlay(null), 600); armHide();
  };

  const pct = duration ? (current / duration) * 100 : 0;
  const stopBubble = (e: React.SyntheticEvent) => e.stopPropagation();
  const areControlsVisible = showControls && !isSwipingActive && !isLocked;

  return (
    <div
      ref={wrapRef}
      className={`bg-black overflow-hidden select-none ${
        expanded ? "fixed inset-0 z-50 h-dvh w-screen" : "relative w-full aspect-video"
      }`}
      onClick={() => { if (!showControls) { setShowControls(true); armHide(); } }}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      style={{ filter: `brightness(${brightness}%)` }}
    >
      <video
        ref={videoRef} src={src}
        className="w-full h-full object-contain bg-black transition-transform duration-150"
        playsInline autoPlay muted={muted} loop={looping}
        style={{ transform: `scale(${zoom})` }}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onVolumeChange={() => { if (videoRef.current) { setMuted(videoRef.current.muted); setVolume(videoRef.current.volume); } }}
      />
      
      <div className={`absolute left-3 top-1/2 -translate-y-1/2 z-50 transition-opacity duration-200 ${showControls ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`} onClick={stopBubble} onTouchStart={stopBubble} onTouchEnd={stopBubble}>
        <button onClick={() => { setIsLocked(!isLocked); reveal(); }} className="bg-black/60 text-primary p-3 rounded-full border border-primary/20 backdrop-blur-sm active:scale-90 transition-transform" aria-label={isLocked ? "Unlock interface" : "Lock interface"}>
          {isLocked ? <Lock className="h-5 w-5 text-destructive animate-pulse" /> : <Unlock className="h-5 w-5" />}
        </button>
      </div>

      <div onTouchStart={stopBubble} onTouchEnd={stopBubble} onTouchMove={stopBubble} className={`absolute top-0 left-0 right-0 z-30 flex items-center justify-end gap-1 p-2 bg-gradient-to-b from-black/70 to-transparent transition-opacity duration-200 ${areControlsVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
        <button onClick={toggleMute} className="text-primary p-2.5 active:scale-95">{muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}</button>
        <button onClick={() => { ensureAudioGraph(); audioCtxRef.current?.resume(); setShowEq(!showEq); setShowSpeed(false); reveal(); }} className="text-primary p-2.5 active:scale-95"><Sliders className="h-5 w-5" /></button>
        <button onClick={() => { setShowSpeed(!showSpeed); setShowEq(false); reveal(); }} className="text-primary p-2.5 flex items-center gap-1 active:scale-95"><Gauge className="h-5 w-5" /> <span className="text-xs">{speed}x</span></button>
        <button onClick={toggleFullscreen} className="text-primary p-2.5 active:scale-95"><Maximize className="h-5 w-5" /></button>
        <button onClick={toggleLoop} className={`p-2.5 active:scale-95 ${looping ? "text-primary" : "text-muted-foreground"}`}><Repeat className="h-5 w-5" /></button>
        <button onClick={cycleZoom} className="text-primary p-2.5 active:scale-95 flex items-center gap-1"><ZoomIn className="h-5 w-5" /> <span className="text-xs">{Math.round(zoom * 100)}%</span></button>
      </div>

      {showSpeed && areControlsVisible && (
        <div className="absolute top-14 right-3 z-40 bg-black/90 rounded-lg p-2 flex flex-col gap-1" onClick={stopBubble}>
          {SPEEDS.map((s) => (<button key={s} onClick={() => setSpeedVal(s)} className={`px-3 py-1 text-sm rounded ${speed === s ? "bg-primary text-primary-foreground" : "text-white"}`}>{s}x</button>))}
        </div>
      )}

      {showEq && areControlsVisible && (
        <div className="absolute top-14 right-3 z-40 bg-black/90 rounded-lg p-3 w-48 space-y-2" onClick={stopBubble}>
          {(["bass", "mid", "treble"] as const).map((k) => (
            <div key={k}>
              <div className="flex justify-between text-xs text-white capitalize"><span>{k}</span><span>{eq[k]}</span></div>
              <input type="range" min={0} max={100} value={eq[k]} onChange={(e) => setEq((p) => ({ ...p, [k]: parseInt(e.target.value) }))} className="w-full accent-primary" />
            </div>
          ))}
        </div>
      )}

      <div className={`absolute inset-0 z-10 flex items-center justify-center gap-8 transition-opacity duration-200 ${areControlsVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
        <button onClick={(e) => { stopBubble(e); onPrev?.(); reveal(); }} className="text-primary p-2"><SkipBack className="h-9 w-9 fill-current" /></button>
        <button onClick={(e) => { stopBubble(e); togglePlay(); }} className="text-primary p-2">{playing ? <Pause className="h-12 w-12 fill-current" /> : <Play className="h-12 w-12 fill-current" />}</button>
        <button onClick={(e) => { stopBubble(e); onNext?.(); reveal(); }} className="text-primary p-2"><SkipForward className="h-9 w-9 fill-current" /></button>
      </div>

      {overlay && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
          <div className="bg-black/80 text-white font-medium text-sm px-4 py-2 rounded-lg border border-white/10 shadow-xl">{overlay}</div>
        </div>
      )}

      <div className={`absolute bottom-0 left-0 right-0 z-20 px-3 pb-2 pt-6 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-200 ${areControlsVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`} onClick={stopBubble} onTouchStart={stopBubble} onTouchEnd={stopBubble} onTouchMove={stopBubble}>
        <div className="flex items-center justify-between text-xs text-white mb-1">
          <span>{formatTime(current)}</span> <span>{formatTime(duration)}</span>
        </div>
        <div className="relative h-1 bg-white/30 rounded-full">
          <div className="absolute left-0 top-0 h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
          <input type="range" min={0} max={100} step={0.1} value={pct} onChange={onSeek} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          <div className="absolute -top-1 h-3 w-3 rounded-full bg-primary -translate-x-1/2" style={{ left: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

