import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { CheckCircle2, Circle, FolderPlus, Share2, Trash2, X } from "lucide-react";
import { BottomTabs } from "@/components/BottomTabs";
import { SearchBar } from "@/components/SearchBar";
import { Logo } from "@/components/Logo";
import { useLongPress } from "@/hooks/use-long-press";
import {
  useMediaStore,
  importVideoFiles,
  deleteVideos,
  shareItems,
} from "@/lib/media-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ZabPlay — Videos" },
      { name: "description", content: "Play your videos and music with ZabPlay." },
    ],
  }),
  component: Index,
});

function Index() {
  const { videos } = useMediaStore();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const list = videos.filter((v) => v.title.toLowerCase().includes(q.toLowerCase()));

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const enterSelect = (id: string) => {
    setSelectMode(true);
    setSelected(new Set([id]));
  };

  const exitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const onDelete = () => {
    if (selected.size === 0) return;
    if (confirm(`Delete ${selected.size} video(s)?`)) {
      deleteVideos([...selected]);
      exitSelect();
    }
  };

  const onShare = () => {
    const items = videos.filter((v) => selected.has(v.id)).map((v) => ({ title: v.title, src: v.src }));
    if (items.length === 0) return;
    shareItems(items);
  };

  const allSelected = list.length > 0 && list.every((v) => selected.has(v.id));

  return (
    <div className="min-h-screen bg-background mx-auto max-w-md pb-20">
      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) importVideoFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="px-4 pt-5 pb-3 space-y-4 sticky top-0 bg-background/95 backdrop-blur z-30 border-b border-border/50">
        {selectMode ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={exitSelect} className="p-2 -ml-2" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
              <span className="text-base font-semibold">{selected.size} selected</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSelected(allSelected ? new Set() : new Set(list.map((v) => v.id)))}
                className="text-xs px-2 py-1 rounded-md bg-secondary"
              >
                {allSelected ? "Clear" : "All"}
              </button>
              <button onClick={onShare} className="p-2" aria-label="Share">
                <Share2 className="h-5 w-5" />
              </button>
              <button onClick={onDelete} className="p-2 text-destructive" aria-label="Delete">
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <Logo />
            <div className="flex items-center gap-1 -mr-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="p-2 text-foreground/80"
                aria-label="Import from gallery"
              >
                <FolderPlus className="h-5 w-5" />
              </button>
              <button
                onClick={() => {
                  const items = videos.map((v) => ({ title: v.title, src: v.src }));
                  shareItems(items.slice(0, 5));
                }}
                className="p-2 text-foreground/80"
                aria-label="Share"
              >
                <Share2 className="h-5 w-5" />
              </button>
              <button
                onClick={() => setSelectMode(true)}
                className="p-2 text-foreground/80"
                aria-label="Select"
              >
                <CheckCircle2 className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
        <SearchBar value={q} onChange={setQ} placeholder="Search videos..." />
      </div>

      {list.length === 0 ? (
        <div className="px-6 py-16 text-center text-muted-foreground text-sm">
          No videos yet. Tap{" "}
          <FolderPlus className="inline h-4 w-4 align-text-bottom" /> to add from your gallery.
        </div>
      ) : (
        <ul className="px-3 pt-3 space-y-2">
          {list.map((v) => (
            <VideoRow
              key={v.id}
              video={v}
              selectMode={selectMode}
              selected={selected.has(v.id)}
              onOpen={() => navigate({ to: "/video/$id", params: { id: v.id } })}
              onToggle={() => toggle(v.id)}
              onLongPress={() => enterSelect(v.id)}
            />
          ))}
        </ul>
      )}

      <BottomTabs />
    </div>
  );
}

function VideoRow({
  video,
  selectMode,
  selected,
  onOpen,
  onToggle,
  onLongPress,
}: {
  video: { id: string; title: string; duration: string; thumb: string };
  selectMode: boolean;
  selected: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onLongPress: () => void;
}) {
  const { didTrigger, ...pressHandlers } = useLongPress(onLongPress, 450);
  return (
    <li>
      <button
        {...pressHandlers}
        onClick={() => {
          if (didTrigger()) return;
          if (selectMode) onToggle();
          else onOpen();
        }}
        className={`w-full flex gap-3 items-center p-2 rounded-xl text-left transition-colors ${
          selected ? "bg-primary/15" : "active:bg-secondary"
        }`}
      >
        {selectMode && (
          <div className="flex-shrink-0">
            {selected ? (
              <CheckCircle2 className="h-5 w-5 text-primary" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        )}
        <div className="relative h-20 w-32 overflow-hidden rounded-lg border border-border/60 bg-secondary/70 flex-shrink-0">
          <img src={video.thumb} alt={video.title} className="h-full w-full object-cover" loading="lazy" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent px-2 py-1 text-right">
            <span className="text-[10px] text-foreground">{video.duration}</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground line-clamp-2 font-medium">{video.title}</p>
        </div>
      </button>
    </li>
  );
}

// keep Link import used by tooling
void Link;
