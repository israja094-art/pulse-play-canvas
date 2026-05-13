import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  MoreVertical,
  Heart,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
} from "lucide-react";
import { formatTime } from "@/lib/media-data";
import { useMediaStore } from "@/lib/media-store";

export const Route = createFileRoute("/music/$id")({
  component: NowPlaying,
});

function NowPlaying() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { songs } = useMediaStore();

  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [liked, setLiked] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);

  const idx = Math.max(0, songs.findIndex((s) => s.id === id));
  const song = songs[idx];

  useEffect(() => {
    const a = audioRef.current;
    if (!a || !song) return;
    setCurrent(0);
    const tryPlay = async () => {
      try {
        await a.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
    };
    tryPlay();
  }, [id, song]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurrent(a.currentTime);
    const onMeta = () => setDuration(a.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnd = () => {
      if (repeat) {
        a.currentTime = 0;
        a.play().catch(() => {});
        return;
      }
      const ni = shuffle
        ? Math.floor(Math.random() * Math.max(1, songs.length))
        : (idx + 1) % Math.max(1, songs.length);
      if (songs[ni]) navigate({ to: "/music/$id", params: { id: songs[ni].id } });
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnd);
    };
  }, [repeat, shuffle, idx, songs, navigate]);

  if (!song) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        No song
      </div>
    );
  }

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  };

  const next = () => {
    const ni = shuffle
      ? Math.floor(Math.random() * songs.length)
      : (idx + 1) % songs.length;
    navigate({ to: "/music/$id", params: { id: songs[ni].id } });
  };
  const prev = () => {
    const pi = (idx - 1 + songs.length) % songs.length;
    navigate({ to: "/music/$id", params: { id: songs[pi].id } });
  };

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = audioRef.current;
    if (!a) return;
    const t = (parseFloat(e.target.value) / 100) * (a.duration || 0);
    a.currentTime = t;
    setCurrent(t);
  };

  const pct = duration ? (current / duration) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/20 via-background to-background mx-auto max-w-md flex flex-col">
      <audio ref={audioRef} src={song.src} preload="metadata" />
      <header className="flex items-center justify-between px-4 py-3">
        <button onClick={() => navigate({ to: "/music" })} aria-label="Close">
          <ChevronDown className="h-6 w-6 text-primary" />
        </button>
        <p className="text-sm font-medium">Now Playing</p>
        <button aria-label="More">
          <MoreVertical className="h-5 w-5 text-primary" />
        </button>
      </header>

      <div className="px-6 mt-4">
        <div className="aspect-square w-full rounded-2xl overflow-hidden bg-muted shadow-2xl ring-1 ring-primary/20">
          <img src={song.cover} alt={song.title} className="w-full h-full object-cover" />
        </div>
      </div>

      <div className="px-6 mt-8 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold truncate">{song.title}</h2>
          <p className="text-muted-foreground truncate">{song.artist}</p>
        </div>
        <button onClick={() => setLiked((l) => !l)} aria-label="Like" className="p-2">
          <Heart className={`h-7 w-7 ${liked ? "fill-primary text-primary" : "text-foreground"}`} />
        </button>
      </div>

      <div className="px-6 mt-6">
        <div className="relative h-1 bg-secondary rounded-full">
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
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          <span>{formatTime(current)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="px-6 mt-8 flex items-center justify-between">
        <button onClick={() => setShuffle((s) => !s)} className={shuffle ? "text-primary" : "text-muted-foreground"} aria-label="Shuffle">
          <Shuffle className="h-5 w-5" />
        </button>
        <button onClick={prev} aria-label="Previous" className="text-primary">
          <SkipBack className="h-7 w-7" />
        </button>
        <button
          onClick={toggle}
          className="h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg"
          aria-label="Play/Pause"
        >
          {playing ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7 ml-1" />}
        </button>
        <button onClick={next} aria-label="Next" className="text-primary">
          <SkipForward className="h-7 w-7" />
        </button>
        <button onClick={() => setRepeat((r) => !r)} className={repeat ? "text-primary" : "text-muted-foreground"} aria-label="Repeat">
          <Repeat className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
