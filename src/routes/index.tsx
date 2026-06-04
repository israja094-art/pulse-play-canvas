import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState, useEffect } from "react";
import {
  CheckCircle2,
  Circle,
  Share2,
  Trash2,
  X,
  Folder,
  History,
  Search,
  MoreVertical,
  Square,
  CheckSquare,
  Lock,
  ArrowRightLeft,
  Scissors,
  Edit3,
  HardDrive,
  Music,
  Settings2
} from "lucide-react";
import { BottomTabs } from "@/components/BottomTabs";
import { Logo } from "@/components/Logo";
import { useLongPress } from "@/hooks/use-long-press";
import { runNativeScan } from "@/lib/native-scanner";
import {
  useMediaStore,
  deleteVideos,
  shareItems,
  renameVideoFile,
  moveVideosToPrivacy,
  getPrivacyVideos,
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

type HistoryItem = {
  id: string;
  title: string;
  thumb: string;
  duration: string;
  progress: number;
  lastPlayed: number;
};

const getFolderName = (src: string) => {
  let folderName = "Internal Storage";
  if (src && src.includes("/")) {
    const parts = src.split("/");
    if (parts.length > 1) folderName = parts[parts.length - 2] || "Internal Storage";
  }
  if (folderName.toLowerCase() === "0" || folderName === "") folderName = "Main Storage";
  return folderName;
};

function Index() {
  const { videos } = useMediaStore();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [showMenuDropdown, setShowMenuDropdown] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [activeTab, setActiveTab] = useState<"all" | "folders">("all");
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  
  const [watchingHistory, setWatchingHistory] = useState<HistoryItem[]>([]);

  // --- POPUPS & DIALOGS REAL STATES ---
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [newTitleValue, setNewTitleValue] = useState("");
  
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [privacyVideosList, setPrivacyVideosList] = useState<any[]>([]);

  const [showStorageModal, setShowStorageModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // --- 🔐 SECURITY PASSWORD SYSTEM STATES ---
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinMode, setPinMode] = useState<"setup" | "unlock_hide" | "unlock_view">("setup");
  const [inputPin, setInputPin] = useState("");
  const [savedPin, setSavedPin] = useState<string | null>(null);
  
  const pinInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const pin = localStorage.getItem("zabplay_privacy_pin");
    if (pin) {
      setSavedPin(pin);
    }
  }, []);

  useEffect(() => {
    if (showPinModal) {
      setTimeout(() => {
        pinInputRef.current?.focus();
      }, 150);
    }
  }, [showPinModal]);

  useEffect(() => {
    const loadHistory = () => {
      try {
        const raw = localStorage.getItem("zabplay_watching_history");
        if (raw) {
          const parsed: HistoryItem[] = JSON.parse(raw);
          const validHistory = parsed.filter(h => videos.some(v => v.id === h.id));
          validHistory.sort((a, b) => b.lastPlayed - a.lastPlayed);
          setWatchingHistory(validHistory);
        }
      } catch (e) {
        console.error("Error loading history:", e);
      }
    };

    loadHistory();
  }, [videos, activeTab]);

  useEffect(() => {
    const savedScrollY = sessionStorage.getItem("homepage_scroll_pos");
    if (savedScrollY) {
      const timer = setTimeout(() => {
        window.scrollTo(0, parseInt(savedScrollY, 10));
        sessionStorage.removeItem("homepage_scroll_pos");
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [videos, q, activeTab, currentFolder]);

  useEffect(() => {
    const triggerFirstScan = async () => {
      try {
        console.log("App mounted: Dispatching non-blocking storage bridge authorization...");
        await runNativeScan(true);
      } catch (err) {
        console.warn("Deferred permission bridge route bypass executed", err);
      }
    };
    
    const timer = setTimeout(() => {
      void triggerFirstScan();
    }, 150);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!showMenuDropdown) return;
    const closeMenu = () => setShowMenuDropdown(false);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, [showMenuDropdown]);

  const query = q.trim().toLowerCase();
  const filteredVideos = videos.filter(
    (v) =>
      v.title.toLowerCase().includes(query) ||
      getFolderName(v.src).toLowerCase().includes(query),
  );

  const foldersMap: Record<string, typeof videos> = {};
  filteredVideos.forEach((video) => {
    const folderName = getFolderName(video.src);
    if (!foldersMap[folderName]) {
      foldersMap[folderName] = [];
    }
    foldersMap[folderName].push(video);
  });

  let contentLayout;

  if (activeTab === "all") {
    contentLayout = (
      <ul className="px-3 pt-3 space-y-2">
        {filteredVideos.map((v) => (
          <VideoRow
            key={v.id}
            video={v}
            selectMode={selectMode}
            selected={selected.has(v.id)}
            onOpen={() => {
              sessionStorage.setItem("homepage_scroll_pos", window.scrollY.toString());
              navigate({ to: "/video/$id", params: { id: v.id } });
            }}
            onToggle={() => toggle(v.id)}
            onLongPress={() => enterSelect(v.id)}
          />
        ))}
      </ul>
    );
  } else {
    if (currentFolder) {
      const folderVideos = foldersMap[currentFolder] || [];
      contentLayout = (
        <div className="space-y-2">
          <div className="px-4 py-2 flex items-center justify-between bg-secondary/30 border-b border-border/30">
            <span className="text-sm font-semibold text-primary truncate">Folder: {currentFolder}</span>
            <button 
              onClick={() => setCurrentFolder(null)}
              className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-md font-medium"
            >
              Back to Folders
            </button>
          </div>
          <ul className="px-3 pt-1 space-y-2">
            {folderVideos.map((v) => (
              <VideoRow
                key={v.id}
                video={v}
                selectMode={selectMode}
                selected={selected.has(v.id)}
                onOpen={() => {
                  sessionStorage.setItem("homepage_scroll_pos", window.scrollY.toString());
                  navigate({ to: "/video/$id", params: { id: v.id } });
                }}
                onToggle={() => toggle(v.id)}
                onLongPress={() => enterSelect(v.id)}
              />
            ))}
          </ul>
        </div>
      );
    } else {
      const folderNames = Object.keys(foldersMap);
      if (folderNames.length === 0) {
        contentLayout = (
          <div className="px-6 py-16 text-center text-muted-foreground text-sm">No folders found.</div>
        );
      } else {
        contentLayout = (
          <div className="px-4 pt-3 grid grid-cols-2 gap-3">
            {folderNames.map((name) => (
              <button
                key={name}
                onClick={() => {
                  if (selectMode) return;
                  setCurrentFolder(name);
                }}
                className="flex flex-col items-center justify-center p-4 rounded-xl border border-border/60 bg-secondary/20 active:bg-secondary/50 transition-all text-center gap-2"
              >
                <div className="relative p-3 bg-primary/10 rounded-xl text-primary">
                  <Folder className="h-8 w-8 fill-primary/20" />
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] px-1.5 min-w-[18px] h-4 flex items-center justify-center rounded-full font-bold">
                    {foldersMap[name].length}
                  </span>
                </div>
                <span className="text-sm font-medium text-foreground line-clamp-1 w-full px-1">
                  {name}
                </span>
              </button>
            ))}
          </div>
        );
      }
    }
  }

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
    const items = videos
      .filter((v) => selected.has(v.id))
      .map((v) => ({ id: v.id, title: v.title, src: v.src }));
    if (items.length === 0) return;
    shareItems(items);
    exitSelect();
  };

  const onPrivacySecure = () => {
    if (selected.size === 0) return;
    setInputPin("");
    if (!savedPin) {
      setPinMode("setup");
    } else {
      setPinMode("unlock_hide");
    }
    setShowPinModal(true);
  };

  const executePrivacyLock = () => {
    moveVideosToPrivacy([...selected]);
    alert(`${selected.size} Video(s) successfully locked in Privacy Folder!`);
    exitSelect();
  };

  const onRename = () => {
    if (selected.size === 0) return;
    const firstId = Array.from(selected)[0];
    const itemToRename = videos.find(v => v.id === firstId);
    if (itemToRename) {
      setRenameTargetId(firstId);
      setNewTitleValue(itemToRename.title);
      setShowRenameModal(true);
    }
  };

  const saveRenameAction = async () => {
    if (renameTargetId && newTitleValue.trim()) {
      await renameVideoFile(renameTargetId, newTitleValue.trim());
      setShowRenameModal(false);
      exitSelect();
    }
  };

  const onFileTransfer = () => {
    if (selected.size === 0) return;
    alert(`Transferring ${selected.size} video file(s)...`);
    exitSelect();
  };

  const onVideoCut = () => {
    if (selected.size === 0) return;
    alert("Opening Video Cutter tool for selected file.");
    exitSelect();
  };

  const handleDropdownAction = async (actionName: string) => {
    if (actionName === "Settings") {
      alert(`Opening feature: ${actionName}`);
    } else if (actionName === "File Transfer") {
      alert(`Opening feature: ${actionName}`);
    } else if (actionName === "MP3 Converter") {
      alert(`Opening feature: ${actionName}`);
    } else if (actionName === "Storage Info") {
      setShowStorageModal(true);
    } else if (actionName === "History") {
      setShowHistoryModal(true);
    } else if (actionName === "Privacy Folder") {
      setInputPin("");
      if (!savedPin) {
        setPinMode("setup");
      } else {
        setPinMode("unlock_view");
      }
      setShowPinModal(true);
    }
  };

  // 🔥 ADVANCED PROFESSIONAL NON-BLOCKING PIN ENGINE
  const handlePinSubmit = () => {
    if (inputPin.length !== 4) {
      alert("Please enter a valid 4-digit PIN.");
      return;
    }

    // 1. Keyboard ko sabse pehle niche bitha do taaki input lock na phase
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    if (pinMode === "setup") {
      // Setup direct close bina spinner lagaye
      localStorage.setItem("zabplay_privacy_pin", inputPin);
      setSavedPin(inputPin);
      setShowPinModal(false);
      setTimeout(() => {
        alert("Privacy PIN successfully set!");
      }, 100);

    } else if (pinMode === "unlock_hide") {
      if (inputPin === savedPin) {
        // Pehle modal gayab karo taaki UI freeze na lage
        setShowPinModal(false);
        // Chupchaap next micro-task me file operation run karo
        setTimeout(() => {
          executePrivacyLock();
        }, 150);
      } else {
        alert("Incorrect PIN! Please try again.");
        setInputPin("");
        setTimeout(() => pinInputRef.current?.focus(), 100);
      }

    } else if (pinMode === "unlock_view") {
      if (inputPin === savedPin) {
        // Modal turant band karo
        setShowPinModal(false);
        // Background non-blocking execution
        setTimeout(async () => {
          try {
            const data = await getPrivacyVideos();
            setPrivacyVideosList(data || []);
            setShowPrivacyModal(true);
          } catch (err) {
            console.error("Native storage read crash protected:", err);
            setPrivacyVideosList([]);
            setShowPrivacyModal(true);
          }
        }, 150);
      } else {
        alert("Incorrect PIN! Please try again.");
        setInputPin("");
        setTimeout(() => pinInputRef.current?.focus(), 100);
      }
    }
  };

  const currentTabVideos = activeTab === "all" 
    ? filteredVideos 
    : (currentFolder ? foldersMap[currentFolder] || [] : filteredVideos);

  const allSelected = currentTabVideos.length > 0 && currentTabVideos.every((v) => selected.has(v.id));

  const handleSelectAllToggle = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(currentTabVideos.map((v) => v.id)));
    }
  };

  return (
    <div className="min-h-screen bg-background mx-auto max-w-md pb-32">
      {/* --- STICKY TOP HEADER ZONE --- */}
      <div className="px-4 pt-5 pb-3 space-y-4 sticky top-0 bg-background/95 backdrop-blur z-30 border-b border-border/50">
        {selectMode ? (
          <div className="flex items-center justify-between h-10 animate-fadeIn">
            <div className="flex items-center gap-3">
              <button onClick={handleSelectAllToggle} className="text-primary active:scale-90 transition-transform" aria-label="Select All Toggle">
                {allSelected ? (
                  <CheckSquare className="h-6 w-6 fill-primary/10" />
                ) : (
                  <Square className="h-6 w-6 text-muted-foreground" />
                )}
              </button>
              <span className="text-base font-semibold text-foreground">
                {selected.size} / {currentTabVideos.length} Selected
              </span>
            </div>
            <button onClick={exitSelect} className="p-2 rounded-full bg-secondary/50 text-foreground active:scale-90 transition-transform">
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between h-10">
              <Logo />
              <div className="flex items-center gap-1 relative">
                <button
                  onClick={() => setShowSearchInput(!showSearchInput)}
                  className={`p-2 rounded-full transition-colors ${showSearchInput ? "bg-primary/20 text-primary" : "text-foreground/80 active:bg-secondary"}`}
                  aria-label="Toggle search input"
                >
                  <Search className="h-5 w-5" />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenuDropdown(!showMenuDropdown);
                  }}
                  className={`p-2 rounded-full transition-colors ${showMenuDropdown ? "bg-secondary text-primary" : "text-foreground/80 active:bg-secondary"}`}
                  aria-label="More options"
                >
                  <MoreVertical className="h-5 w-5 font-bold scale-y-110" />
                </button>

                {showMenuDropdown && (
                  <div className="absolute right-0 top-12 w-52 bg-background/95 border border-border/80 rounded-2xl shadow-2xl z-50 py-2 animate-scaleUp backdrop-blur-md">
                    <button onClick={() => handleDropdownAction("File Transfer")} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground/90 active:bg-primary/15 transition-colors text-left">
                      <ArrowRightLeft className="h-4 w-4 text-primary" />
                      <span className="font-medium">File Transfer</span>
                    </button>
                    <button onClick={() => handleDropdownAction("Storage Info")} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground/90 active:bg-primary/15 transition-colors text-left">
                      <HardDrive className="h-4 w-4 text-primary" />
                      <span className="font-medium">Storage Info</span>
                    </button>
                    <button onClick={() => handleDropdownAction("Privacy Folder")} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground/90 active:bg-primary/15 transition-colors text-left">
                      <Lock className="h-4 w-4 text-primary" />
                      <span className="font-medium">Privacy Folder</span>
                    </button>
                    <button onClick={() => handleDropdownAction("History")} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground/90 active:bg-primary/15 transition-colors text-left">
                      <History className="h-4 w-4 text-primary" />
                      <span className="font-medium">History</span>
                    </button>
                    <button onClick={() => handleDropdownAction("MP3 Converter")} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground/90 active:bg-primary/15 transition-colors text-left">
                      <Music className="h-4 w-4 text-primary" />
                      <span className="font-medium">MP3 Converter</span>
                    </button>
                    <button onClick={() => handleDropdownAction("Settings")} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground/90 active:bg-primary/15 transition-colors text-left border-t border-border/40 mt-1 pt-2">
                      <Settings2 className="h-4 w-4 text-primary" />
                      <span className="font-medium">Settings</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {showSearchInput && (
              <div className="relative animate-slideDown w-full">
                <input
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search videos..."
                  className="w-full bg-secondary/50 text-sm text-foreground placeholder:text-muted-foreground pl-4 pr-10 py-2 rounded-xl border border-border/40 focus:outline-none focus:border-primary/50 transition-all"
                  autoFocus
                />
                {q && (
                  <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* --- TAB SYSTEM DESIGN --- */}
        {!selectMode && (
          <div className="flex bg-secondary/40 p-1 rounded-xl w-full border border-border/30">
            <button
              onClick={() => {
                setActiveTab("all");
                setCurrentFolder(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all text-center ${
                activeTab === "all"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Videos
            </button>
            <button
              onClick={() => setActiveTab("folders")}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all text-center ${
                activeTab === "folders"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Folders
            </button>
          </div>
        )}
      </div>

      {/* --- WATCHING HISTORY HORIZONTAL SLIDER BLOCK --- */}
      {!selectMode && watchingHistory.length > 0 && !currentFolder && (
        <div className="mt-2 mb-4 border-b border-border/20 pb-4">
          <div className="px-4 mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <History className="h-3.5 w-3.5 text-primary" />
            <span>Watching History</span>
          </div>
          <div className="flex gap-3 overflow-x-auto px-4 scrollbar-none snap-x">
            {watchingHistory.map((item) => (
              <button
                key={`hist-${item.id}`}
                onClick={() => {
                  sessionStorage.setItem("homepage_scroll_pos", window.scrollY.toString());
                  navigate({ to: "/video/$id", params: { id: item.id } });
                }}
                className="w-32 flex-shrink-0 text-left snap-start space-y-1.5 group active:opacity-70 transition-opacity"
              >
                <div className="relative h-20 w-32 overflow-hidden rounded-lg border border-border/50 bg-secondary/60">
                  <img src={item.thumb} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
                  <div className="absolute bottom-0 left-0 w-full h-1 bg-black/40">
                    <div className="h-full bg-red-500 transition-all duration-300" style={{ width: `${item.progress}%` }} />
                  </div>
                  <div className="absolute inset-x-0 bottom-1.5 px-2 py-0.5 text-right">
                    <span className="text-[9px] text-white font-medium bg-black/60 px-1 rounded">{item.duration}</span>
                  </div>
                </div>
                <p className="text-xs font-medium text-foreground line-clamp-1 group-hover:text-primary transition-colors">{item.title}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* --- MAIN CONTENT DISPLAY AREA --- */}
      {filteredVideos.length === 0 ? (
        <div className="px-6 py-16 text-center text-muted-foreground text-sm">
          No videos yet. Drop videos into your storage to start playing.
        </div>
      ) : (
        contentLayout
      )}

      {/* --- 🔐 PREMIUM FIXED MODAL: PRIVACY PIN SETUP & UNLOCK ENGINE --- */}
      {showPinModal && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[99999] pointer-events-auto"
          onClick={() => pinInputRef.current?.focus()}
        >
          <div 
            className="bg-[#0b1220] w-[290px] rounded-[24px] p-6 border border-white/10 shadow-2xl text-center relative space-y-5 pointer-events-auto"
            onClick={(e) => {
              e.stopPropagation();
              pinInputRef.current?.focus();
            }}
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                {pinMode === "setup" ? "Set Privacy Password" : "Enter Privacy PIN"}
              </h3>
              <p className="text-xs text-slate-400 mt-1 px-2">
                {pinMode === "setup" 
                  ? "Create a 4-digit PIN to secure your hidden videos" 
                  : "Please enter verification code to continue"}
              </p>
            </div>
            
            {/* Visible, reliable PIN input + box indicators */}
            <div className="w-full max-w-[210px] mx-auto mt-2 space-y-3">
              <input
                ref={pinInputRef}
                type="tel"
                maxLength={4}
                pattern="[0-9]*"
                inputMode="numeric"
                autoComplete="off"
                value={inputPin}
                onChange={(e) => setInputPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && inputPin.length === 4) handlePinSubmit();
                }}
                placeholder="••••"
                className="w-full h-12 rounded-xl border border-white/15 bg-white/[0.06] text-center text-2xl font-bold tracking-[0.6em] text-white placeholder:text-white/25 outline-none focus:border-primary focus:bg-primary/10 transition-all"
              />

              {/* Box indicators (display only) */}
              <div className="flex justify-between items-center gap-3 pointer-events-none">
                {[0, 1, 2, 3].map((index) => {
                  const isFocused = inputPin.length === index;
                  const hasValue = inputPin.length > index;
                  return (
                    <div
                      key={index}
                      className={`w-11 h-3 rounded-full border transition-all duration-200 ${
                        hasValue
                          ? "border-primary bg-primary"
                          : isFocused
                            ? "border-primary bg-primary/20"
                            : "border-white/10 bg-white/[0.03]"
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Premium Flat Buttons Layout */}
            <div className="flex gap-3 text-xs font-semibold pt-2 relative z-[99999] pointer-events-auto">
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPinModal(false);
                }} 
                className="flex-1 py-3 rounded-xl bg-white/[0.05] text-white/90 active:bg-white/10 transition-colors cursor-pointer pointer-events-auto"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePinSubmit();
                }} 
                disabled={inputPin.length !== 4}
                className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground disabled:opacity-30 disabled:pointer-events-none active:scale-95 transition-transform font-bold cursor-pointer pointer-events-auto"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- REAL MODAL: RENAME POPUP ENGINE --- */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-background w-full max-w-xs rounded-2xl p-4 border border-border/80 shadow-2xl space-y-3">
            <h3 className="text-sm font-bold text-foreground">Rename Video</h3>
            <input 
              type="text" 
              value={newTitleValue}
              onChange={(e) => setNewTitleValue(e.target.value)}
              className="w-full bg-secondary px-3 py-2 text-sm rounded-xl border border-border/40 focus:outline-none focus:border-primary"
            />
            <div className="flex gap-2 justify-end text-xs font-semibold">
              <button onClick={() => setShowRenameModal(false)} className="px-3 py-2 rounded-lg bg-secondary text-foreground">Cancel</button>
              <button onClick={saveRenameAction} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* --- REAL MODAL: PRIVACY FOLDER VIEWER --- */}
      {showPrivacyModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex flex-col z-50 p-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-3 mb-3">
            <div className="flex items-center gap-2 font-bold text-primary">
              <Lock className="h-5 w-5" />
              <span>Secure Privacy Storage</span>
            </div>
            <button onClick={() => setShowPrivacyModal(false)} className="p-1 rounded-full bg-secondary text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2">
            {privacyVideosList.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground mt-10">No videos inside secure privacy folder.</p>
            ) : (
              privacyVideosList.map(v => (
                <div key={`priv-${v.id}`} className="flex items-center gap-3 p-2 bg-secondary/30 rounded-xl">
                  <img src={v.thumb} className="h-12 w-20 object-cover rounded-lg" />
                  <span className="text-xs font-medium truncate flex-1">{v.title}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* --- REAL MODAL: STORAGE INFO VIEW --- */}
      {showStorageModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-background w-full max-w-xs rounded-2xl p-4 border border-border/80 shadow-2xl space-y-4 text-center">
            <HardDrive className="h-8 w-8 text-primary mx-auto" />
            <div>
              <h3 className="text-sm font-bold">Storage Analyzer</h3>
              <p className="text-xs text-muted-foreground mt-1">ZabPlay Local Database Sync Status</p>
            </div>
            <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
              <div className="bg-primary h-full w-[45%]" />
            </div>
            <p className="text-[11px] font-semibold text-foreground/80">IndexedDB: {videos.length} Registered System Tracks</p>
            <button onClick={() => setShowStorageModal(false)} className="w-full py-2 text-xs font-semibold bg-secondary rounded-xl">Close</button>
          </div>
        </div>
      )}

      {/* --- REAL MODAL: ALL HISTORY LIST VIEWER --- */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex flex-col z-50 p-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-3 mb-3">
            <div className="flex items-center gap-2 font-bold text-primary">
              <History className="h-5 w-5" />
              <span>Full Watching History ({watchingHistory.length})</span>
            </div>
            <button onClick={() => setShowHistoryModal(false)} className="p-1 rounded-full bg-secondary text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2">
            {watchingHistory.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground mt-10">No history found.</p>
            ) : (
              watchingHistory.map(h => (
                <div key={`fullhist-${h.id}`} className="flex items-center gap-3 p-2 bg-secondary/30 rounded-xl">
                  <img src={h.thumb} className="h-12 w-20 object-cover rounded-lg" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{h.title}</p>
                    <p className="text-[10px] text-red-500 font-bold mt-0.5">Watched {h.progress.toFixed(0)}%</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* BOTTOM ACTION BAR PATTI */}
      {selectMode && (
        <div className="fixed bottom-0 left-0 right-0 mx-auto max-w-md bg-background/95 border-t border-border/60 backdrop-blur-md shadow-2xl z-50 animate-slideUp">
          <div className="flex items-center justify-around py-3 px-2">
            <button onClick={onShare} disabled={selected.size === 0} className="flex flex-col items-center justify-center flex-1 text-primary disabled:opacity-40 disabled:pointer-events-none active:scale-90 transition-transform">
              <Share2 className="h-5 w-5 mb-1" />
              <span className="text-[10px] font-medium text-foreground/80">Share</span>
            </button>
            <button onClick={onPrivacySecure} disabled={selected.size === 0} className="flex flex-col items-center justify-center flex-1 text-primary disabled:opacity-40 disabled:pointer-events-none active:scale-90 transition-transform">
              <Lock className="h-5 w-5 mb-1" />
              <span className="text-[10px] font-medium text-foreground/80">Privacy</span>
            </button>
            <button onClick={onDelete} disabled={selected.size === 0} className="flex flex-col items-center justify-center flex-1 text-destructive disabled:opacity-40 disabled:pointer-events-none active:scale-90 transition-transform">
              <Trash2 className="h-5 w-5 mb-1" />
              <span className="text-[10px] font-medium text-foreground/80">Delete</span>
            </button>
            <button onClick={onFileTransfer} disabled={selected.size === 0} className="flex flex-col items-center justify-center flex-1 text-primary disabled:opacity-40 disabled:pointer-events-none active:scale-90 transition-transform">
              <ArrowRightLeft className="h-5 w-5 mb-1" />
              <span className="text-[10px] font-medium text-foreground/80">Transfer</span>
            </button>
            <button onClick={onVideoCut} disabled={selected.size === 0} className="flex flex-col items-center justify-center flex-1 text-primary disabled:opacity-40 disabled:pointer-events-none active:scale-90 transition-transform">
              <Scissors className="h-5 w-5 mb-1" />
              <span className="text-[10px] font-medium text-foreground/80">Cut Video</span>
            </button>
            <button onClick={onRename} disabled={selected.size === 0} className="flex flex-col items-center justify-center flex-1 text-primary disabled:opacity-40 disabled:pointer-events-none active:scale-90 transition-transform">
              <Edit3 className="h-5 w-5 mb-1" />
              <span className="text-[10px] font-medium text-foreground/80">Rename</span>
            </button>
          </div>
        </div>
      )}

      {!selectMode && <BottomTabs />}
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
  video: { id: string; title: string; duration: string; thumb: string; src: string };
  selectMode: boolean;
  selected: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onLongPress: () => void;
}) {
  const { didTrigger, ...pressHandlers } = useLongPress(onLongPress, 450);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("zabplay_watching_history");
      if (raw) {
        const parsed: HistoryItem[] = JSON.parse(raw);
        const currentItem = parsed.find(h => h.id === video.id);
        if (currentItem) {
          setProgress(currentItem.progress);
        }
      }
    } catch {
      const saved = localStorage.getItem(`history_${video.src}`);
      if (saved) {
        const parts = video.duration.split(':').map(Number);
        const totalSec = parts.length === 2 ? parts[0] * 60 + parts[1] : 0;
        if (totalSec > 0) {
          const p = (parseFloat(saved) / totalSec) * 100;
          setProgress(Math.min(p, 100));
        }
      }
    }
  }, [video.id, video.src, video.duration]);

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
        <div className="relative h-20 w-32 overflow-hidden rounded-lg border border-border/60 bg-secondary/70 flex-shrink-0">
          <img src={video.thumb} alt={video.title} className="h-full w-full object-cover" loading="lazy" />
          {selectMode && (
            <div className="absolute top-1.5 left-1.5 bg-black/40 rounded-full p-0.5 backdrop-blur-sm z-10">
              {selected ? (
                <CheckCircle2 className="h-4 w-4 text-primary fill-background" />
              ) : (
                <Circle className="h-4 w-4 text-white/80" />
              )}
            </div>
          )}
          {progress > 2 && (
            <div className="absolute bottom-0 left-0 w-full h-1 bg-white/20">
              <div className="h-full bg-red-500" style={{ width: `${progress}%` }} />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-1 px-2 py-1 text-right">
            <span className="text-[10px] text-white font-medium bg-black/50 px-1 rounded">{video.duration}</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground line-clamp-2 font-medium">{video.title}</p>
          <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground truncate">
            <Folder className="h-3 w-3 text-primary flex-shrink-0" />
            <span className="truncate">{getFolderName(video.src)}</span>
          </p>
        </div>
      </button>
    </li>
  );
    }
