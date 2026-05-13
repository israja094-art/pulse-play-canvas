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
import { songs, formatTime } from "@/lib/media-data";

export const Route = createFileRoute("/music/$id")({
  component: NowPlaying,
});

function NowPlaying() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const idx = Math.max(
    0,
    songs.findIndex((s) => s.id === id)
  );
  const song = songs[idx];

  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [liked, setLiked] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    setCurrent(0);
    a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [id]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurrent(a.currentTime);
    const onMeta = () => setDuration(a.duration);
    const onEnd = () => {
      if (repeat) {
        a.currentTime = 0;
        a.play();
        return;
      }
      next();
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repeat, shuffle, idx]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play();
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
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
    <div className="min-h-screen bg-background mx-auto max-w-md flex flex-col">
      <audio ref={audioRef} src={song.src} preload="metadata" />
      <header className="flex items-center justify-between px-4 py-3">
        <button onClick={() => navigate({ to: "/music" })} aria-label="Close">
          <ChevronDown className="h-6 w-6" />
        </button>
        <p className="text-sm font-medium">Now Playing</p>
        <button aria-label="More">
          <MoreVertical className="h-5 w-5" />
        </button>
      </header>

      <div className="px-6 mt-4">
        <div className="aspect-square w-full rounded-2xl overflow-hidden bg-muted shadow-2xl">
          <img src={song.cover} alt={song.title} className="w-full h-full object-cover" />
        </div>
      </div>

      <div className="px-6 mt-8 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold truncate">{song.title}</h2>
          <p className="text-muted-foreground truncate">{song.artist}</p>
        </div>
        <button onClick={() => setLiked((l) => !l)} aria-label="Like" className="p-2">
          <Heart
            className={`h-7 w-7 ${liked ? "fill-primary text-primary" : "text-foreground"}`}
          />
        </button>
      </div>

      <div className="px-6 mt-6">
        <div className="relative h-1 bg-secondary rounded-full">
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
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          <span>{formatTime(current)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="px-6 mt-8 flex items-center justify-between">
        <button
          onClick={() => setShuffle((s) => !s)}
          className={shuffle ? "text-primary" : "text-muted-foreground"}
          aria-label="Shuffle"
        >
          <Shuffle className="h-5 w-5" />
        </button>
        <button onClick={prev} aria-label="Previous">
          <SkipBack className="h-7 w-7" />
        </button>
        <button
          onClick={toggle}
          className="h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg"
          aria-label="Play/Pause"
        >
          {playing ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7 ml-1" />}
        </button>
        <button onClick={next} aria-label="Next">
          <SkipForward className="h-7 w-7" />
        </button>
        <button
          onClick={() => setRepeat((r) => !r)}
          className={repeat ? "text-primary" : "text-muted-foreground"}
          aria-label="Repeat"
        >
          <Repeat className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
