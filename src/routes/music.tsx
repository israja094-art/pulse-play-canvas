import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { MoreVertical } from "lucide-react";
import { songs } from "@/lib/media-data";
import { BottomTabs } from "@/components/BottomTabs";
import { SearchBar } from "@/components/SearchBar";

export const Route = createFileRoute("/music")({
  head: () => ({
    meta: [
      { title: "Music — Player" },
      { name: "description", content: "Browse and play music." },
    ],
  }),
  component: MusicPage,
});

function MusicPage() {
  const [q, setQ] = useState("");
  const list = songs.filter(
    (s) =>
      s.title.toLowerCase().includes(q.toLowerCase()) ||
      s.artist.toLowerCase().includes(q.toLowerCase())
  );
  return (
    <div className="min-h-screen bg-background mx-auto max-w-md pb-20">
      <div className="px-4 pt-6 pb-3 space-y-3 sticky top-0 bg-background z-30">
        <h1 className="text-2xl font-semibold">Music</h1>
        <SearchBar value={q} onChange={setQ} placeholder="Search music..." />
      </div>
      <ul className="px-2">
        {list.map((s) => (
          <li key={s.id}>
            <Link
              to="/music/$id"
              params={{ id: s.id }}
              className="flex items-center gap-3 px-2 py-2.5 rounded-lg active:bg-secondary"
            >
              <img
                src={s.cover}
                alt={s.title}
                className="w-12 h-12 rounded-md object-cover flex-shrink-0"
                loading="lazy"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground font-medium truncate">{s.title}</p>
                <p className="text-xs text-muted-foreground truncate">{s.artist}</p>
              </div>
              <button
                onClick={(e) => e.preventDefault()}
                className="p-2 text-muted-foreground"
                aria-label="More"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </Link>
          </li>
        ))}
      </ul>
      <BottomTabs />
    </div>
  );
}
