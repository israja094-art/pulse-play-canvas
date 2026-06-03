import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Play, Pencil, ListPlus, Share2, Trash2, Check } from "lucide-react";
import {
  deleteSongs,
  renameSong,
  addToPlaylist,
  removeFromPlaylist,
  isInPlaylist,
  shareItems,
} from "@/lib/media-store";

export type SongLike = { id: string; title: string; artist?: string; src: string };

function Sheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-t-3xl border border-border/60 bg-popover px-3 pb-7 pt-3 shadow-2xl">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border" />
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function SongActionMenu({
  song,
  onClose,
  onPlay,
}: {
  song: SongLike;
  onClose: () => void;
  onPlay: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(song.title);
  const inPlaylist = isInPlaylist(song.id);

  if (renaming) {
    return (
      <Sheet onClose={onClose}>
        <p className="px-2 pb-3 text-base font-semibold text-foreground">Rename song</p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-border/60 bg-secondary px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/50"
        />
        <div className="mt-3 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-secondary py-3 text-sm font-medium text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              renameSong(song.id, name);
              onClose();
            }}
            className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
          >
            Save
          </button>
        </div>
      </Sheet>
    );
  }

  const Item = ({
    icon,
    label,
    onClick,
    danger,
  }: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    danger?: boolean;
  }) => (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-xl px-4 py-3.5 text-left text-sm font-medium active:bg-secondary ${
        danger ? "text-destructive" : "text-foreground"
      }`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-primary">
        {icon}
      </span>
      {label}
    </button>
  );

  return (
    <Sheet onClose={onClose}>
      <p className="truncate px-4 pb-2 text-sm font-semibold text-foreground">{song.title}</p>
      <div className="space-y-0.5">
        <Item
          icon={<Play className="h-5 w-5" />}
          label="Play now"
          onClick={() => {
            onPlay();
            onClose();
          }}
        />
        <Item
          icon={<Pencil className="h-5 w-5" />}
          label="Rename"
          onClick={() => setRenaming(true)}
        />
        <Item
          icon={inPlaylist ? <Check className="h-5 w-5" /> : <ListPlus className="h-5 w-5" />}
          label={inPlaylist ? "Remove from playlist" : "Add to playlist"}
          onClick={() => {
            if (inPlaylist) removeFromPlaylist([song.id]);
            else addToPlaylist([song.id]);
            onClose();
          }}
        />
        <Item
          icon={<Share2 className="h-5 w-5" />}
          label="Share"
          onClick={() => {
            shareItems([{ id: song.id, title: song.title, src: song.src }]);
            onClose();
          }}
        />
        <Item
          icon={<Trash2 className="h-5 w-5" />}
          label="Delete"
          danger
          onClick={() => {
            if (confirm(`Delete "${song.title}"?`)) {
              deleteSongs([song.id]);
            }
            onClose();
          }}
        />
      </div>
    </Sheet>
  );
}

export { Sheet };
