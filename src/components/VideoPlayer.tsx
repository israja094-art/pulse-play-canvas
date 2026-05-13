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
} from "lucide-react";
import { formatTime } from "@/lib/media-data";

const SPEEDS = [0.5, 1, 1.25, 1.5, 2];

export function VideoPlayer({
  src,
  poster,
  onEnded,
  onPrev,
  onNext,
}: {
  src: string;
  poster?: string;
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
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<{ t: number; x: number } | null>(null);

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
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrent(v.currentTime);
    const onMeta = () => setDuration(v.duration);
    const onEnd = () => {
      setPlaying(false);
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
  }, [onEnded]);

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
    setMuted(v.muted);
    reveal();
  };

  const toggleFullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.();
    }
    reveal();
  };

  const setSpeedVal = (s: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = s;
    setSpeed(s);
    setShowSpeed(false);
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
      className="relative w-full aspect-video bg-black overflow-hidden select-none"
      onClick={reveal}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ filter: `brightness(${brightness}%)` }}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="w-full h-full object-contain bg-black"
        playsInline
        autoPlay
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      {/* Top bar icons */}
      <div
        onTouchStart={stopBubble}
        onTouchEnd={stopBubble}
        onTouchMove={stopBubble}
        className={`absolute top-0 left-0 right-0 flex items-center justify-end gap-1 p-2 bg-gradient-to-b from-black/70 to-transparent transition-opacity ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <button
          onClick={(e) => { stopBubble(e); toggleMute(); }}
          aria-label="Mute"
          className="text-primary p-2.5 active:scale-95"
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
        <button
          onClick={(e) => {
            stopBubble(e);
            ensureAudioGraph();
            audioCtxRef.current?.resume();
            setShowEq((s) => !s);
            setShowSpeed(false);
            reveal();
          }}
          aria-label="Equalizer"
          className="text-primary p-2.5 active:scale-95"
        >
          <Sliders className="h-5 w-5" />
        </button>
        <button
          onClick={(e) => {
            stopBubble(e);
            setShowSpeed((s) => !s);
            setShowEq(false);
            reveal();
          }}
          aria-label="Speed"
          className="text-primary p-2.5 flex items-center gap-1 active:scale-95"
        >
          <Gauge className="h-5 w-5" />
          <span className="text-xs">{speed}x</span>
        </button>
        <button
          onClick={(e) => { stopBubble(e); toggleFullscreen(); }}
          aria-label="Fullscreen"
          className="text-primary p-2.5 active:scale-95"
        >
          <Maximize className="h-5 w-5" />
        </button>
      </div>

      {showSpeed && (
        <div
          className="absolute top-14 right-3 bg-black/90 rounded-lg p-2 z-20 flex flex-col gap-1"
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
          className="absolute top-14 right-3 bg-black/90 rounded-lg p-3 z-20 w-48 space-y-2"
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
        className={`absolute inset-0 flex items-center justify-center gap-8 transition-opacity ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <button
          onClick={(e) => { stopBubble(e); onPrev?.(); reveal(); }}
          onTouchStart={stopBubble}
          onTouchEnd={stopBubble}
          className="text-primary p-2"
          aria-label="Previous"
        >
          <SkipBack className="h-9 w-9 fill-current" />
        </button>
        <button
          onClick={(e) => { stopBubble(e); togglePlay(); }}
          onTouchStart={stopBubble}
          onTouchEnd={stopBubble}
          className="text-primary p-2"
          aria-label="Play/Pause"
        >
          {playing ? <Pause className="h-12 w-12 fill-current" /> : <Play className="h-12 w-12 fill-current" />}
        </button>
        <button
          onClick={(e) => { stopBubble(e); onNext?.(); reveal(); }}
          onTouchStart={stopBubble}
          onTouchEnd={stopBubble}
          className="text-primary p-2"
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
        className={`absolute bottom-0 left-0 right-0 px-3 pb-2 pt-6 bg-gradient-to-t from-black/80 to-transparent transition-opacity ${
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
