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
}: {
  src: string;
  poster?: string;
  onEnded?: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
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

  const armHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 3000);
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

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
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
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta));
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
  };

  // Gestures: left half = brightness (vertical), right half = volume (vertical),
  // horizontal = seek
  const gesture = useRef<{
    x: number;
    y: number;
    side: "L" | "R";
    mode: "" | "h" | "v";
    startTime: number;
    startVol: number;
    startBri: number;
  } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    gesture.current = {
      x: t.clientX,
      y: t.clientY,
      side: t.clientX - rect.left < rect.width / 2 ? "L" : "R",
      mode: "",
      startTime: videoRef.current?.currentTime ?? 0,
      startVol: volume,
      startBri: brightness,
    };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const g = gesture.current;
    if (!g) return;
    const t = e.touches[0];
    const dx = t.clientX - g.x;
    const dy = t.clientY - g.y;
    if (g.mode === "") {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      g.mode = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
    }
    const v = videoRef.current;
    if (!v) return;
    if (g.mode === "h") {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const ratio = dx / rect.width; // full sweep = 60s
      const delta = ratio * 60;
      const next = Math.max(0, Math.min(v.duration || 0, g.startTime + delta));
      v.currentTime = next;
      setCurrent(next);
      setOverlay(`${delta >= 0 ? "+" : ""}${Math.round(delta)}s`);
    } else {
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
    }
    setShowControls(true);
  };

  const onTouchEnd = () => {
    gesture.current = null;
    setTimeout(() => setOverlay(null), 600);
    armHide();
  };

  const pct = duration ? (current / duration) * 100 : 0;

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
        className={`absolute top-0 left-0 right-0 flex items-center justify-end gap-3 p-3 bg-gradient-to-b from-black/70 to-transparent transition-opacity ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleMute();
          }}
          aria-label="Mute"
          className="text-white p-2"
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowEq((s) => !s);
            setShowSpeed(false);
            reveal();
          }}
          aria-label="Equalizer"
          className="text-white p-2"
        >
          <Sliders className="h-5 w-5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowSpeed((s) => !s);
            setShowEq(false);
            reveal();
          }}
          aria-label="Speed"
          className="text-white p-2 flex items-center gap-1"
        >
          <Gauge className="h-5 w-5" />
          <span className="text-xs">{speed}x</span>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFullscreen();
          }}
          aria-label="Fullscreen"
          className="text-white p-2"
        >
          <Maximize className="h-5 w-5" />
        </button>
      </div>

      {/* Speed menu */}
      {showSpeed && (
        <div
          className="absolute top-14 right-3 bg-black/90 rounded-lg p-2 z-20 flex flex-col gap-1"
          onClick={(e) => e.stopPropagation()}
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

      {/* EQ panel */}
      {showEq && (
        <div
          className="absolute top-14 right-3 bg-black/90 rounded-lg p-3 z-20 w-48 space-y-2"
          onClick={(e) => e.stopPropagation()}
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

      {/* Center play/pause + skip */}
      <div
        className={`absolute inset-0 flex items-center justify-center gap-8 transition-opacity ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            seekBy(-10);
            reveal();
          }}
          className="text-white p-2"
          aria-label="Back 10s"
        >
          <SkipBack className="h-9 w-9" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          className="text-white p-2"
          aria-label="Play/Pause"
        >
          {playing ? <Pause className="h-12 w-12" /> : <Play className="h-12 w-12" />}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            seekBy(10);
            reveal();
          }}
          className="text-white p-2"
          aria-label="Forward 10s"
        >
          <SkipForward className="h-9 w-9" />
        </button>
      </div>

      {/* Gesture overlay text */}
      {overlay && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/70 text-white text-sm px-4 py-2 rounded-lg">{overlay}</div>
        </div>
      )}

      {/* Bottom progress */}
      <div
        className={`absolute bottom-0 left-0 right-0 px-3 pb-2 pt-6 bg-gradient-to-t from-black/80 to-transparent transition-opacity ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between text-xs text-white mb-1">
          <span>{formatTime(current)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        <div className="relative h-1 bg-white/30 rounded-full">
          <div
            className="absolute left-0 top-0 h-full bg-primary rounded-full"
            style={{ width: `${pct}%` }}
          />
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={pct}
            onChange={onSeek}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div
            className="absolute -top-1 h-3 w-3 rounded-full bg-primary -translate-x-1/2"
            style={{ left: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
