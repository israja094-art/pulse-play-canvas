import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { CheckCircle2, Circle, FolderPlus, Share2, Trash2, X } from "lucide-react";
import { BottomTabs } from "@/components/BottomTabs";
import { SearchBar } from "@/components/SearchBar";
import { Logo } from "@/components/Logo";
import { useLongPress } from "@/hooks/use-long-press";
import {
  useMediaStore,
  importAudioFiles,
  deleteSongs,
  shareItems,
} from "@/lib/media-store";

export const Route = createFileRoute("/music")({
  head: () => ({
    meta: [
      { title: "ZabPlay — Music" },
      { name: "description", content: "Play music from your gallery with ZabPlay." },
    ],
  }),
  component: MusicPage,
});

function MusicPage() {
  const { songs } = useMediaStore();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const list = songs.filter(
    (s) =>
      s.title.toLowerCase().includes(q.toLowerCase()) ||
      s.artist.toLowerCase().includes(q.toLowerCase()),
  );

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

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
    if (confirm(`Delete ${selected.size} song(s)?`)) {
      deleteSongs([...selected]);
      exitSelect();
    }
  };
  const onShare = () => {
    const items = songs.filter((s) => selected.has(s.id)).map((s) => ({ title: s.title, src: s.src }));
    shareItems(items);
  };

  const allSelected = list.length > 0 && list.every((s) => selected.has(s.id));

  return (
    <div className="min-h-screen bg-background mx-auto max-w-md pb-20">
      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) importAudioFiles(e.target.files);
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
                onClick={() => setSelected(allSelected ? new Set() : new Set(list.map((s) => s.id)))}
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
                onClick={() => shareItems(songs.slice(0, 5).map((s) => ({ title: s.title, src: s.src })))}
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
        <SearchBar value={q} onChange={setQ} placeholder="Search music..." />
      </div>

      {list.length === 0 ? (
        <div className="px-6 py-16 text-center text-muted-foreground text-sm">
          No music yet. Tap <FolderPlus className="inline h-4 w-4 align-text-bottom" /> to add audio.
        </div>
      ) : (
        <ul className="px-2 pt-2">
          {list.map((s) => (
            <SongRow
              key={s.id}
              song={s}
              selectMode={selectMode}
              selected={selected.has(s.id)}
              onOpen={() => navigate({ to: "/music/$id", params: { id: s.id } })}
              onToggle={() => toggle(s.id)}
              onLongPress={() => enterSelect(s.id)}
            />
          ))}
        </ul>
      )}

      <BottomTabs />
    </div>
  );
}

function SongRow({
  song,
  selectMode,
  selected,
  onOpen,
  onToggle,
  onLongPress,
}: {
  song: { id: string; title: string; artist: string; cover: string };
  selectMode: boolean;
  selected: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onLongPress: () => void;
}) {
  const lp = useLongPress(onLongPress, 450);
  return (
    <li>
      <button
        {...lp}
        onClick={() => {
          if (lp.didTrigger()) return;
          if (selectMode) onToggle();
          else onOpen();
        }}
        className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-left ${
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
        <img src={song.cover} alt={song.title} className="w-12 h-12 rounded-md object-cover flex-shrink-0" loading="lazy" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground font-medium truncate">{song.title}</p>
          <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
        </div>
      </button>
    </li>
  );
}
