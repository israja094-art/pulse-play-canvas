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
import { syncSongSource } from "@/lib/audio-player";
import { useMediaStore } from "@/lib/media-store";

export const Route = createFileRoute("/music/$id")({
  component: NowPlaying,
});

function NowPlaying() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { songs } = useMediaStore();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [liked, setLiked] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);

  const idx = Math.max(0, songs.findIndex((s) => s.id === id));
  const song = songs[idx];
  const nextSong = songs.length > 0 ? songs[(idx + 1) % songs.length] : null;

  useEffect(() => {
    if (!song) return;
    const a = syncSongSource({ id: song.id, src: song.src });
    audioRef.current = a;
    if (!a) return;
    setCurrent(a.currentTime || 0);
    setDuration(a.duration || 0);
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

  const closePlayer = () => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.currentTime = 0;
    }
    navigate({ to: "/music" });
  };

  useEffect(() => {
    return () => {
      const a = audioRef.current;
      if (a) a.pause();
    };
  }, []);

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
      setPlaying(false);
      setCurrent(a.duration || 0);
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
  }, [repeat]);

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
    <div className="relative mx-auto flex h-dvh max-w-md flex-col overflow-hidden bg-background">
      <div className="absolute inset-0">
        <img src={song.cover} alt={song.title} className="h-full w-full object-cover opacity-20 blur-3xl scale-110" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/45 via-background/78 to-background" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-4 pt-4 pb-3">
        <button
          onClick={closePlayer}
          aria-label="Close"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border/60 bg-background/55 backdrop-blur"
        >
          <ChevronDown className="h-6 w-6 text-primary" />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground truncate max-w-[10rem]">{song.title}</p>
          <p className="text-[11px] text-muted-foreground">{song.artist}</p>
        </div>
        <button
          aria-label="More"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border/60 bg-background/55 backdrop-blur"
        >
          <MoreVertical className="h-5 w-5 text-primary" />
        </button>
      </header>

      <div className="relative z-10 flex-1 px-5 pb-4 pt-3 overflow-hidden">
        <div className="flex h-full flex-col gap-5 overflow-hidden rounded-[2rem] border border-border/60 bg-card/25 px-4 py-4 backdrop-blur-sm">
          <div className="relative aspect-square w-full overflow-hidden rounded-[1.6rem] border border-border/60 bg-card/70 shadow-2xl shadow-primary/10 max-h-[42vh] flex-shrink-0">
          <img src={song.cover} alt={song.title} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/55 via-transparent to-transparent" />
          <div className="absolute left-4 right-4 bottom-4 flex items-center justify-between rounded-2xl border border-border/60 bg-background/55 px-4 py-3 backdrop-blur-md">
            <div className="min-w-0">
              <p className="truncate text-xs uppercase tracking-[0.22em] text-muted-foreground">Now playing</p>
              <p className="truncate text-sm font-semibold text-foreground">{song.duration || formatTime(duration)}</p>
            </div>
            <button
              onClick={() => setLiked((l) => !l)}
              aria-label="Like"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card/80 text-foreground"
            >
              <Heart className={`h-6 w-6 ${liked ? "fill-primary text-primary" : "text-foreground"}`} />
            </button>
          </div>
          </div>

          <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-end">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="line-clamp-2 text-2xl font-bold text-foreground">{song.title}</h1>
                <p className="mt-1 truncate text-sm text-muted-foreground">{song.artist}</p>
              </div>
              <div className="rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-xs font-medium text-primary backdrop-blur">
                {song.duration || formatTime(duration || 0)}
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground overflow-hidden">
              <span className={`rounded-full border px-3 py-1.5 ${shuffle ? "border-primary/60 bg-primary/10 text-primary" : "border-border/60 bg-card/45"}`}>
                Shuffle
              </span>
              <span className={`rounded-full border px-3 py-1.5 ${repeat ? "border-primary/60 bg-primary/10 text-primary" : "border-border/60 bg-card/45"}`}>
                Repeat
              </span>
              {nextSong ? <span className="truncate rounded-full border border-border/60 bg-card/45 px-3 py-1.5">Next: {nextSong.title}</span> : null}
            </div>

            <div className="mt-5">
              <div className="relative h-2 rounded-full bg-secondary/90">
                <div className="absolute left-0 top-0 h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.1}
                  value={pct}
                  onChange={onSeek}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
                <div className="absolute -top-1.5 h-5 w-5 rounded-full border-4 border-background bg-primary shadow-lg shadow-primary/30 -translate-x-1/2" style={{ left: `${pct}%` }} />
              </div>
              <div className="mt-3 flex justify-between text-xs font-medium text-muted-foreground">
                <span>{formatTime(current)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between rounded-[2rem] border border-border/60 bg-card/55 px-5 py-4 backdrop-blur-md shadow-xl shadow-primary/5">
                <button onClick={() => setShuffle((s) => !s)} className={shuffle ? "text-primary" : "text-muted-foreground"} aria-label="Shuffle">
                  <Shuffle className="h-5 w-5" />
                </button>
                <button onClick={prev} aria-label="Previous" className="text-primary">
                  <SkipBack className="h-8 w-8" />
                </button>
                <button
                  onClick={toggle}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl shadow-primary/30"
                  aria-label="Play/Pause"
                >
                  {playing ? <Pause className="h-7 w-7" /> : <Play className="ml-1 h-7 w-7" />}
                </button>
                <button onClick={next} aria-label="Next" className="text-primary">
                  <SkipForward className="h-8 w-8" />
                </button>
                <button onClick={() => setRepeat((r) => !r)} className={repeat ? "text-primary" : "text-muted-foreground"} aria-label="Repeat">
                  <Repeat className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
