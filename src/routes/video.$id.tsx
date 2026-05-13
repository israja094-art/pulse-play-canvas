import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { ArrowLeft, MoreVertical, Cast, Captions, Trash2, Play, AudioLines } from "lucide-react";
import { videos } from "@/lib/media-data";
import { VideoPlayer } from "@/components/VideoPlayer";
import { BottomTabs } from "@/components/BottomTabs";

export const Route = createFileRoute("/video/$id")({
  component: VideoPage,
});

function VideoPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [list, setList] = useState(videos);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const current = list.find((v) => v.id === id) ?? list[0];

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (!current) return null;

  const goNext = () => {
    const idx = list.findIndex((v) => v.id === current.id);
    const next = list[(idx + 1) % list.length];
    navigate({ to: "/video/$id", params: { id: next.id } });
  };

  return (
    <div className="min-h-screen bg-background mx-auto max-w-md pb-20">
      <VideoPlayer src={current.src} poster={current.thumb} onEnded={goNext} />

      {/* Top floating header over player handled inside; add back/menu bar above player */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-md flex items-center justify-between p-3 z-10 pointer-events-none">
        <Link to="/" className="text-white p-2 pointer-events-auto" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-2 pointer-events-auto">
          <button className="text-white p-2" aria-label="Cast">
            <Cast className="h-5 w-5" />
          </button>
          <button className="text-white p-2" aria-label="Captions">
            <Captions className="h-5 w-5" />
          </button>
          <button className="text-white p-2" aria-label="More">
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
      </div>

      <ul className="mt-2">
        {list.map((v) => {
          const active = v.id === current.id;
          return (
            <li key={v.id} className="relative">
              <button
                onClick={() => navigate({ to: "/video/$id", params: { id: v.id } })}
                className="w-full flex gap-3 items-center px-4 py-2 text-left"
              >
                <div className="relative w-24 h-14 rounded-md overflow-hidden flex-shrink-0 bg-muted">
                  <img src={v.thumb} alt={v.title} className="w-full h-full object-cover" />
                  <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-white text-[9px] px-1 rounded">
                    {v.duration}
                  </span>
                </div>
                <p
                  className={`flex-1 text-sm line-clamp-2 ${
                    active ? "text-primary" : "text-foreground"
                  }`}
                >
                  {v.title}
                </p>
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
              </button>
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
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent/20">
                    <AudioLines className="h-4 w-4" /> Share
                  </button>
                  <button
                    onClick={() => {
                      setList((l) => l.filter((x) => x.id !== v.id));
                      setOpenMenu(null);
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
