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
} from "lucide-react";
import { formatTime } from "@/lib/media-data";
import {
  lockOrientation,
  unlockOrientation,
  hideSystemUi,
  showSystemUi,
} from "@/lib/native-ui";

const SPEEDS = [0.5, 1, 1.25, 1.5, 2];

type VideoEl = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitDisplayingFullscreen?: boolean;
};

export function VideoPlayer({
  src,
  onEnded,
  onPrev,
  onNext,
}: {
  src: string;
  onEnded?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
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
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<{ t: number; x: number } | null>(null);
  const lastActionRef = useRef<{ key: string; at: number } | null>(null);
  const pinchRef = useRef<{ distance: number; startZoom: number } | null>(null);

  const flashOverlay = useCallback((text: string, ms = 900) => {
    setOverlay(text);
    window.setTimeout(() => setOverlay(null), ms);
  }, []);

  const runButtonAction = useCallback((key: string, fn: () => void) => {
    const now = Date.now();
    if (lastActionRef.current?.key === key && now - lastActionRef.current.at < 250) return;
    lastActionRef.current = { key, at: now };
    fn();
  }, []);

  const stopAndRun = useCallback((key: string, fn: () => void) => (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    runButtonAction(key, fn);
  }, [runButtonAction]);

  const armHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setShowControls(false);
      setShowSpeed(false);
      setShowEq(false);
    }, 3000);
  }, []);

  const reveal = useCallback(() => {
    setShowControls(true);
    armHide();
  }, [armHide]);

  useEffect(() => {
    armHide();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [armHide]);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setExpanded(false);
        void unlockOrientation();
        void showSystemUi();
      }
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!expanded) return;

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [expanded]);

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
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.playbackRate = 1;
    v.muted = false;
    v.volume = 1;
    v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [src]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.loop = looping;
  }, [looping]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrent(v.currentTime);
    const onMeta = () => setDuration(v.duration);
    const onEnd = () => {
      setPlaying(false);
      if (looping) return;
      onEnded?.();
    };
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("ended", onEnd);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("ended", onEnd);
    };
  }, [looping, onEnded]);

  const ensureAudioGraph = useCallback(() => {
    const v = videoRef.current;
    if (!v || sourceRef.current) return;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const source = ctx.createMediaElementSource(v);
      const bass = ctx.createBiquadFilter();
      bass.type = "lowshelf";
      bass.frequency.value = 200;
      const mid = ctx.createBiquadFilter();
      mid.type = "peaking";
      mid.frequency.value = 1000;
      mid.Q.value = 1;
      const treble = ctx.createBiquadFilter();
      treble.type = "highshelf";
      treble.frequency.value = 3000;
      source.connect(bass).connect(mid).connect(treble).connect(ctx.destination);
      audioCtxRef.current = ctx;
      sourceRef.current = source;
      eqNodesRef.current = { bass, mid, treble };
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const nodes = eqNodesRef.current;
    if (!nodes) return;
    const toDb = (v: number) => ((v - 50) / 50) * 12;
    nodes.bass.gain.value = toDb(eq.bass);
    nodes.mid.gain.value = toDb(eq.mid);
    nodes.treble.gain.value = toDb(eq.treble);
  }, [eq]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    audioCtxRef.current?.resume();
    if (v.paused) {
      v.play().catch(() => {});
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
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
    if (!v.muted && v.volume === 0) {
      v.volume = 1;
      setVolume(1);
    }
    setMuted(v.muted);
    flashOverlay(v.muted ? "Muted" : `Volume ${Math.round(v.volume * 100)}%`);
    reveal();
  };

  const toggleFullscreen = () => {
    const el = wrapRef.current;
    const v = videoRef.current as VideoEl | null;
    if (!el || !v) return;

    const exiting = document.fullscreenElement === el || expanded;
    if (exiting) {
      if (document.fullscreenElement === el) {
        document.exitFullscreen?.().catch(() => setExpanded(false));
      } else {
        setExpanded(false);
      }
      void unlockOrientation();
      void showSystemUi();
      flashOverlay("Mini player");
      reveal();
      return;
    }

    if (el.requestFullscreen) {
      el.requestFullscreen()
        .then(() => lockOrientation("landscape"))
        .catch(() => setExpanded(true));
    } else if (v.webkitEnterFullscreen) {
      try {
        v.webkitEnterFullscreen();
      } catch {
        setExpanded(true);
      }
      void lockOrientation("landscape");
    } else {
      setExpanded(true);
      void lockOrientation("landscape");
    }
    void hideSystemUi();
    flashOverlay("Fullscreen");
    reveal();
  };

  const cycleZoom = () => {
    const levels = [1, 1.25, 1.5, 2];
    const currentIndex = levels.findIndex((level) => Math.abs(level - zoom) < 0.01);
    const next = levels[(currentIndex + 1) % levels.length];
    setZoom(next);
    flashOverlay(`Zoom ${Math.round(next * 100)}%`);
    reveal();
  };

  const toggleLoop = () => {
    setLooping((prev) => {
      const next = !prev;
      flashOverlay(next ? "Loop on" : "Loop off");
      return next;
    });
    reveal();
  };

  const setSpeedVal = (s: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = s;
    setSpeed(s);
    setShowSpeed(false);
    flashOverlay(`Speed ${s}x`);
    reveal();
  };

  // Gestures
  const gesture = useRef<{
    x: number;
    y: number;
    side: "L" | "R";
    mode: "" | "v" | "h";
    startVol: number;
    startBri: number;
    startTime: number;
    width: number;
  } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    gesture.current = {
      x: t.clientX,
      y: t.clientY,
      side: t.clientX - rect.left < rect.width / 2 ? "L" : "R",
      mode: "",
      startVol: volume,
      startBri: brightness,
      startTime: videoRef.current?.currentTime ?? 0,
      width: rect.width,
    };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (!pinchRef.current) {
        pinchRef.current = { distance, startZoom: zoom };
      } else {
        const next = Math.max(1, Math.min(3, pinchRef.current.startZoom * (distance / pinchRef.current.distance)));
        setZoom(next);
        setOverlay(`Zoom ${Math.round(next * 100)}%`);
      }
      setShowControls(true);
      return;
    }

    const g = gesture.current;
    if (!g) return;
    const t = e.touches[0];
    const dx = t.clientX - g.x;
    const dy = t.clientY - g.y;
    if (g.mode === "") {
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
      g.mode = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
    }
    const v = videoRef.current;
    if (!v) return;
    if (g.mode === "h") {
      // 1 minute over full width
      const seekDelta = (dx / g.width) * 60;
      const next = Math.max(0, Math.min(v.duration || 0, g.startTime + seekDelta));
      setOverlay(`${seekDelta >= 0 ? "+" : ""}${Math.round(seekDelta)}s  ${formatTime(next)}`);
      setCurrent(next);
      setShowControls(true);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const ratio = -dy / rect.height;
    if (g.side === "R") {
      const nv = Math.max(0, Math.min(1, g.startVol + ratio));
      v.volume = nv;
      setVolume(nv);
      setOverlay(`Volume ${Math.round(nv * 100)}%`);
    } else {
      const nb = Math.max(20, Math.min(150, g.startBri + ratio * 100));
      setBrightness(nb);
      setOverlay(`Brightness ${Math.round(nb)}%`);
    }
    setShowControls(true);
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (pinchRef.current) {
      pinchRef.current = null;
      setTimeout(() => setOverlay(null), 600);
      armHide();
      return;
    }

    const g = gesture.current;
    if (g && g.mode === "h") {
      const v = videoRef.current;
      const last = e.changedTouches[0];
      if (v && last) {
        const dx = last.clientX - g.x;
        const seekDelta = (dx / g.width) * 60;
        const next = Math.max(0, Math.min(v.duration || 0, g.startTime + seekDelta));
        v.currentTime = next;
        setCurrent(next);
      }
      gesture.current = null;
      setTimeout(() => setOverlay(null), 600);
      armHide();
      return;
    }
    // Treat as tap → check double-tap
    if (g && g.mode === "") {
      const now = Date.now();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = (e.changedTouches[0]?.clientX ?? g.x) - rect.left;
      if (lastTapRef.current && now - lastTapRef.current.t < 300) {
        const sameSide =
          (lastTapRef.current.x < rect.width / 2 && x < rect.width / 2) ||
          (lastTapRef.current.x >= rect.width / 2 && x >= rect.width / 2);
        if (sameSide) {
          seekBy(x >= rect.width / 2 ? 10 : -10);
          lastTapRef.current = null;
          gesture.current = null;
          armHide();
          return;
        }
      }
      lastTapRef.current = { t: now, x };
    }
    gesture.current = null;
    setTimeout(() => setOverlay(null), 600);
    armHide();
  };

  const pct = duration ? (current / duration) * 100 : 0;
  const stopBubble = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div
      ref={wrapRef}
      className={`bg-black overflow-hidden select-none ${
        expanded ? "fixed inset-0 z-50 h-dvh w-screen" : "relative w-full aspect-video"
      }`}
      onClick={reveal}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ filter: `brightness(${brightness}%)` }}
    >
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain bg-black transition-transform duration-150"
        playsInline
        autoPlay
        muted={muted}
        loop={looping}
        style={{ transform: `scale(${zoom})` }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onVolumeChange={() => {
          const v = videoRef.current;
          if (!v) return;
          setMuted(v.muted);
          setVolume(v.volume);
        }}
      />

      {/* Top bar icons */}
      <div
        onTouchStart={stopBubble}
        onTouchEnd={stopBubble}
        onTouchMove={stopBubble}
        className={`absolute top-0 left-0 right-0 z-30 flex items-center justify-end gap-1 p-2 bg-gradient-to-b from-black/70 to-transparent transition-opacity ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <button
          onClick={stopAndRun("mute", toggleMute)}
          onTouchEnd={stopAndRun("mute", toggleMute)}
          aria-label="Mute"
          className="text-primary p-2.5 active:scale-95"
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
        <button
          onClick={stopAndRun("eq", () => {
            ensureAudioGraph();
            audioCtxRef.current?.resume();
            setShowEq((s) => !s);
            setShowSpeed(false);
            flashOverlay(showEq ? "Mixer closed" : "Mixer opened");
            reveal();
          })}
          onTouchEnd={stopAndRun("eq", () => {
            ensureAudioGraph();
            audioCtxRef.current?.resume();
            setShowEq((s) => !s);
            setShowSpeed(false);
            flashOverlay(showEq ? "Mixer closed" : "Mixer opened");
            reveal();
          })}
          aria-label="Equalizer"
          className="text-primary p-2.5 active:scale-95"
        >
          <Sliders className="h-5 w-5" />
        </button>
        <button
          onClick={stopAndRun("speed", () => {
            setShowSpeed((s) => !s);
            setShowEq(false);
            reveal();
          })}
          onTouchEnd={stopAndRun("speed", () => {
            setShowSpeed((s) => !s);
            setShowEq(false);
            reveal();
          })}
          aria-label="Speed"
          className="text-primary p-2.5 flex items-center gap-1 active:scale-95"
        >
          <Gauge className="h-5 w-5" />
          <span className="text-xs">{speed}x</span>
        </button>
        <button
          onClick={stopAndRun("fullscreen", toggleFullscreen)}
          onTouchEnd={stopAndRun("fullscreen", toggleFullscreen)}
          aria-label="Fullscreen"
          className="text-primary p-2.5 active:scale-95"
        >
          <Maximize className="h-5 w-5" />
        </button>
        <button
          onClick={stopAndRun("loop", toggleLoop)}
          onTouchEnd={stopAndRun("loop", toggleLoop)}
          aria-label="Loop"
          className={`p-2.5 active:scale-95 ${looping ? "text-primary" : "text-muted-foreground"}`}
        >
          <Repeat className="h-5 w-5" />
        </button>
        <button
          onClick={stopAndRun("zoom", cycleZoom)}
          onTouchEnd={stopAndRun("zoom", cycleZoom)}
          aria-label="Zoom"
          className="text-primary p-2.5 active:scale-95 flex items-center gap-1"
        >
          <ZoomIn className="h-5 w-5" />
          <span className="text-xs">{Math.round(zoom * 100)}%</span>
        </button>
      </div>

      {showSpeed && (
        <div
          className="absolute top-14 right-3 z-40 bg-black/90 rounded-lg p-2 flex flex-col gap-1"
          onClick={stopBubble}
          onTouchStart={stopBubble}
          onTouchEnd={stopBubble}
          onTouchMove={stopBubble}
        >
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeedVal(s)}
              className={`px-3 py-1 text-sm rounded ${
                speed === s ? "bg-primary text-primary-foreground" : "text-white"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      )}

      {showEq && (
        <div
          className="absolute top-14 right-3 z-40 bg-black/90 rounded-lg p-3 w-48 space-y-2"
          onClick={stopBubble}
          onTouchStart={stopBubble}
          onTouchEnd={stopBubble}
          onTouchMove={stopBubble}
        >
          {(["bass", "mid", "treble"] as const).map((k) => (
            <div key={k}>
              <div className="flex justify-between text-xs text-white capitalize">
                <span>{k}</span>
                <span>{eq[k]}</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={eq[k]}
                onChange={(e) => setEq((p) => ({ ...p, [k]: parseInt(e.target.value) }))}
                className="w-full accent-primary"
              />
            </div>
          ))}
        </div>
      )}

      {/* Center prev / play / next */}
      <div
        className={`pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-8 transition-opacity ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        <button
          onClick={(e) => { stopBubble(e); onPrev?.(); reveal(); }}
          onTouchStart={stopBubble}
          onTouchEnd={stopBubble}
          className="pointer-events-auto text-primary p-2"
          aria-label="Previous"
        >
          <SkipBack className="h-9 w-9 fill-current" />
        </button>
        <button
          onClick={(e) => { stopBubble(e); togglePlay(); }}
          onTouchStart={stopBubble}
          onTouchEnd={stopBubble}
          className="pointer-events-auto text-primary p-2"
          aria-label="Play/Pause"
        >
          {playing ? <Pause className="h-12 w-12 fill-current" /> : <Play className="h-12 w-12 fill-current" />}
        </button>
        <button
          onClick={(e) => { stopBubble(e); onNext?.(); reveal(); }}
          onTouchStart={stopBubble}
          onTouchEnd={stopBubble}
          className="pointer-events-auto text-primary p-2"
          aria-label="Next"
        >
          <SkipForward className="h-9 w-9 fill-current" />
        </button>
      </div>

      {overlay && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/70 text-white text-sm px-4 py-2 rounded-lg">{overlay}</div>
        </div>
      )}

      <div
        className={`absolute bottom-0 left-0 right-0 z-20 px-3 pb-2 pt-6 bg-gradient-to-t from-black/80 to-transparent transition-opacity ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={stopBubble}
        onTouchStart={stopBubble}
        onTouchEnd={stopBubble}
        onTouchMove={stopBubble}
      >
        <div className="flex items-center justify-between text-xs text-white mb-1">
          <span>{formatTime(current)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        <div className="relative h-1 bg-white/30 rounded-full">
          <div className="absolute left-0 top-0 h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={pct}
            onChange={onSeek}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="absolute -top-1 h-3 w-3 rounded-full bg-primary -translate-x-1/2" style={{ left: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
