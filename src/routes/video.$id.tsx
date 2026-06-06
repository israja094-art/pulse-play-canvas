import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { ArrowLeft, MoreVertical, Trash2, Play, AudioLines, Share2 } from "lucide-react";
import { useMediaStore, deleteVideos, shareItems } from "@/lib/media-store";
import { VideoPlayer } from "@/components/VideoPlayer";
import { BottomTabs } from "@/components/BottomTabs";
import { showNativeAlert, showNativeConfirm } from "@/lib/native-dialog";

export const Route = createFileRoute("/video/$id")({
  component: VideoPage,
});

function VideoPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { videos: list } = useMediaStore();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [playerControlsVisible, setPlayerControlsVisible] = useState(true); 
  const menuRef = useRef<HTMLDivElement>(null);
  const current = list.find((v) => v.id === id) ?? list[0];

  // 👑 FIXED: Player ko baar-baar reload hone se bachane ke liye src ko ref mein rakha
  const videoSrcRef = useRef<string>("");
  const videoIdRef = useRef<string>("");

  if (current && current.id !== videoIdRef.current) {
    videoIdRef.current = current.id;
    videoSrcRef.current = current.src;
  }

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
    void navigate({ 
      to: "/video/$id", 
      params: { id: next.id },
      resetScroll: false 
    });
  };

  return (
    <div className="min-h-screen bg-background mx-auto max-w-md pb-20">
      <div 
        className="sticky top-0 z-20 bg-black touch-none"
        onTouchMove={(e) => e.stopPropagation()}
      >
        <div className="relative">
          {/* FIXED: Ab src ko hilaaye bina background mein history save hoti rahegi */}
          <VideoPlayer
            src={videoSrcRef.current}
            onPrev={() => goTo(idx - 1)}
            onNext={() => goTo(idx + 1)}
            onControlsVisibilityChange={(visible) => setPlayerControlsVisible(visible)}
          />
          
          <Link
            to="/"
            resetScroll={false}
            className={`absolute top-3 left-3 z-30 text-primary p-2 rounded-full bg-black/40 transition-opacity duration-200 ${
              playerControlsVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            }`}
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

      <ul className="px-3 pt-3 space-y-2">
        {list.map((v) => {
          const active = v.id === current.id;
          return (
            <li key={v.id} className="relative">
              <div
                className={`flex gap-3 items-center p-2 rounded-xl text-left transition-colors ${
                  active ? "bg-primary/15" : "active:bg-secondary"
                }`}
              >
                <button
                  onClick={() => {
                    void navigate({ 
                      to: "/video/$id", 
                      params: { id: v.id }, 
                      resetScroll: false 
                    });
                  }}
                  className="flex flex-1 gap-3 items-center min-w-0 text-left"
                >
                  <div className="relative h-20 w-32 overflow-hidden rounded-lg border border-border/60 bg-secondary/70 flex-shrink-0">
                    <img
                      src={v.thumb}
                      alt={v.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent px-2 py-1 text-right">
                      <span className="text-[10px] text-foreground">{v.duration}</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm line-clamp-2 font-medium ${active ? "text-primary" : "text-foreground"}`}>
                      {v.title}
                    </p>
                  </div>
                </button>
                
                {active ? (
                  <div className="pr-2 flex-shrink-0">
                    <AudioLines className="h-4 w-4 text-primary animate-pulse" />
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenu(openMenu === v.id ? null : v.id);
                    }}
                    className="p-2 text-muted-foreground"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              {openMenu === v.id && (
                <div
                  ref={menuRef}
                  className="absolute right-3 top-14 z-30 bg-popover border border-border rounded-lg shadow-lg py-1 w-32"
                >
                  <button
                    onClick={() => {
                      setOpenMenu(null);
                      void navigate({ to: "/video/$id", params: { id: v.id }, resetScroll: false });
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
                    onClick={async () => {
                      const ok = await showNativeConfirm(
                        "Delete video",
                        `"${v.title}" ko gallery se permanently delete karna hai?`,
                        "Delete",
                        "Cancel",
                      );
                      if (!ok) {
                        setOpenMenu(null);
                        return;
                      }
                      try {
                        await deleteVideos([v.id]);
                      } catch (error) {
                        const message =
                          error instanceof Error && error.message === "permission-denied"
                            ? "Android permission allow nahi hui. Photos & videos permission allow karke dobara try karo."
                            : "Video ko gallery se delete nahi kiya ja saka. Naya APK install karke dobara try karo, phir Android ke system delete prompt ko allow karo.";
                        await showNativeAlert(
                          "Delete failed",
                          message,
                        );
                        setOpenMenu(null);
                        return;
                      }
                      setOpenMenu(null);
                      if (v.id === current.id) {
                        const remaining = list.filter((x) => x.id !== v.id);
                        if (remaining.length) {
                          void navigate({ to: "/video/$id", params: { id: remaining[0].id }, resetScroll: false });
                        } else {
                          void navigate({ to: "/" });
                        }
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
