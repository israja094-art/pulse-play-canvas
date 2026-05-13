import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { videos } from "@/lib/media-data";
import { BottomTabs } from "@/components/BottomTabs";
import { SearchBar } from "@/components/SearchBar";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Videos — Player" },
      { name: "description", content: "Browse and play beautiful videos." },
    ],
  }),
  component: Index,
});

function Index() {
  const [q, setQ] = useState("");
  const list = videos.filter((v) => v.title.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="min-h-screen bg-background mx-auto max-w-md pb-20">
      <div className="px-4 pt-6 pb-3 space-y-3 sticky top-0 bg-background z-30">
        <h1 className="text-2xl font-semibold">Videos</h1>
        <SearchBar value={q} onChange={setQ} placeholder="Search videos..." />
      </div>
      <ul className="px-4 space-y-3">
        {list.map((v) => (
          <li key={v.id}>
            <Link
              to="/video/$id"
              params={{ id: v.id }}
              className="flex gap-3 items-center group"
            >
              <div className="relative w-32 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                <img
                  src={v.thumb}
                  alt={v.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded">
                  {v.duration}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground line-clamp-2 group-active:text-primary">
                  {v.title}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <BottomTabs />
    </div>
  );
}
