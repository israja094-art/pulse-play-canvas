import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { ArrowLeft, MoreVertical, Trash2, Play, AudioLines, Share2 } from "lucide-react";
import { useMediaStore, deleteVideos, shareItems } from "@/lib/media-store";
import { VideoPlayer } from "@/components/VideoPlayer";
import { BottomTabs } from "@/components/BottomTabs";

export const Route = createFileRoute("/video/$id")({
  component: VideoPage,
});

function VideoPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { videos: list } = useMediaStore();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const current = list.find((v) => v.id === id) ?? list[0];

  useEffect(() => {
    setMounted(true);
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (!mounted) return <div className="min-h-screen bg-background" />;
  if (!current) return null;

  const idx = list.findIndex((v) => v.id === current.id);
  const goTo = (i: number) => {
    const len = list.length;
    if (!len) return;
    const next = list[((i % len) + len) % len];
    navigate({ to: "/video/$id", params: { id: next.id } });
  };

  return (
    <div className="min-h-screen bg-background mx-auto max-w-md pb-20">
      {/* Sticky locked player */}
      <div className="sticky top-0 z-20 bg-black">
        <div className="relative">
          <VideoPlayer
            src={current.src}
            onPrev={() => goTo(idx - 1)}
            onNext={() => goTo(idx + 1)}
          />
          <Link
            to="/"
            className="absolute top-3 left-3 z-30 text-primary p-2 rounded-full bg-black/40"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </div>
        <div className="px-4 py-3 bg-background border-b border-border/50">
          <h1 className="text-sm font-semibold text-foreground line-clamp-2">{current.title}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{current.duration}</p>
        </div>
      </div>

      <ul>
        {list.map((v) => {
          const active = v.id === current.id;
          return (
            <li key={v.id} className="relative">
              <div
                className={`flex gap-3 items-center px-4 py-2 ${active ? "bg-primary/10" : ""}`}
              >
                <button
                  onClick={() => navigate({ to: "/video/$id", params: { id: v.id } })}
                  className="flex flex-1 items-center gap-3 min-w-0 text-left"
                >
                  <img
                    src={v.thumb}
                    alt={v.title}
                    className="h-14 w-24 rounded-md border border-border/60 object-cover flex-shrink-0 bg-secondary/70"
                    loading="lazy"
                  />
                <p
                  className={`flex-1 text-sm line-clamp-2 ${
                    active ? "text-primary font-medium" : "text-foreground"
                  }`}
                >
                  {v.title}
                </p>
                </button>
                {active ? (
                  <AudioLines className="h-4 w-4 text-primary flex-shrink-0" />
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenu(openMenu === v.id ? null : v.id);
                    }}
                    className="p-2 text-muted-foreground"
                    aria-label="More"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                )}
              </div>
              {openMenu === v.id && (
                <div
                  ref={menuRef}
                  className="absolute right-3 top-12 z-30 bg-popover border border-border rounded-lg shadow-lg py-1 w-32"
                >
                  <button
                    onClick={() => {
                      setOpenMenu(null);
                      navigate({ to: "/video/$id", params: { id: v.id } });
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent/20"
                  >
                    <Play className="h-4 w-4" /> Play
                  </button>
                  <button
                    onClick={() => {
                      shareItems([{ title: v.title, src: v.src }]);
                      setOpenMenu(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent/20"
                  >
                    <Share2 className="h-4 w-4" /> Share
                  </button>
                  <button
                    onClick={() => {
                      deleteVideos([v.id]);
                      setOpenMenu(null);
                      if (v.id === current.id) {
                        const remaining = list.filter((x) => x.id !== v.id);
                        if (remaining.length) navigate({ to: "/video/$id", params: { id: remaining[0].id } });
                        else navigate({ to: "/" });
                      }
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-accent/20"
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <BottomTabs />
    </div>
  );
}
