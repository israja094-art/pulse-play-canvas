import { Link, useLocation } from "@tanstack/react-router";
import { Music, PlaySquare } from "lucide-react";

export function BottomTabs() {
  const { pathname } = useLocation();
  const isMusic = pathname.startsWith("/music");
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-card/95 backdrop-blur border-t border-border z-40">
      <div className="grid grid-cols-2">
        <Link
          to="/"
          className={`flex flex-col items-center gap-1 py-3 text-xs ${
            !isMusic ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <PlaySquare className={`h-6 w-6 ${!isMusic ? "fill-primary" : ""}`} />
          Videos
        </Link>
        <Link
          to="/music"
          className={`flex flex-col items-center gap-1 py-3 text-xs ${
            isMusic ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <Music className={`h-6 w-6 ${isMusic ? "fill-primary" : ""}`} />
          Music
        </Link>
      </div>
    </nav>
  );
}
