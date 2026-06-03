import { Outlet, createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Search, MoreVertical, Music2, X } from "lucide-react";
import { BottomTabs } from "@/components/BottomTabs";
import { SearchBar } from "@/components/SearchBar";
import { Logo } from "@/components/Logo";
import { playSongNow } from "@/lib/audio-player";
import { useMediaStore } from "@/lib/media-store";
import { SongActionMenu, type SongLike } from "@/components/SongActionMenu";

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
  const { pathname } = useLocation();
  const { songs } = useMediaStore();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [menuSong, setMenuSong] = useState<SongLike | null>(null);

  if (pathname !== "/music") {
    return <Outlet />;
  }

  const list = songs.filter(
    (s) =>
      s.title.toLowerCase().includes(q.toLowerCase()) ||
      s.artist.toLowerCase().includes(q.toLowerCase()),
  );

  const openSong = (s: { id: string }) => {
    playSongNow({ id: s.id, src: songs.find((x) => x.id === s.id)!.src });
    navigate({ to: "/music/$id", params: { id: s.id } });
  };

  return (
    <div className="min-h-screen bg-background mx-auto max-w-md pb-20">
      <div className="px-4 pt-5 pb-3 space-y-3 sticky top-0 bg-background/95 backdrop-blur z-30 border-b border-border/50">
        <div className="flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-1 -mr-2">
            <button
              onClick={() => setShowSearch((s) => !s)}
              className="p-2 text-foreground/80"
              aria-label="Search"
            >
              {showSearch ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {showSearch && <SearchBar value={q} onChange={setQ} placeholder="Search music..." />}
      </div>

      {list.length === 0 ? (
        <div className="px-6 py-16 text-center text-muted-foreground text-sm">
          No music found yet. Songs from your gallery will appear here automatically once permission is granted.
        </div>
      ) : (
        <ul className="px-2 pt-2">
          {list.map((s) => (
            <SongRow
              key={s.id}
              song={s}
              onOpen={() => openSong(s)}
              onMenu={() => setMenuSong({ id: s.id, title: s.title, artist: s.artist, src: s.src })}
            />
          ))}
        </ul>
      )}

      {menuSong && (
        <SongActionMenu
          song={menuSong}
          onClose={() => setMenuSong(null)}
          onPlay={() => openSong(menuSong)}
        />
      )}

      <BottomTabs />
    </div>
  );
}

function SongRow({
  song,
  onOpen,
  onMenu,
}: {
  song: { id: string; title: string; artist: string };
  onOpen: () => void;
  onMenu: () => void;
}) {
  return (
    <li className="flex items-center gap-2">
      <button
        onClick={onOpen}
        className="flex flex-1 min-w-0 items-center gap-3 px-2 py-2.5 rounded-lg text-left active:bg-secondary"
      >
        <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/20">
          <Music2 className="h-6 w-6 text-primary-foreground" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground font-medium truncate">{song.title}</p>
          <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
        </div>
      </button>
      <button
        onClick={onMenu}
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-foreground/70 active:bg-secondary"
        aria-label="More options"
      >
        <MoreVertical className="h-5 w-5" />
      </button>
    </li>
  );
}
