"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { SoldComps } from "@/components/SoldComps";
import { getStorageUsageMB } from "@/lib/imageCompressor";

type ThemeName = "Arena" | "Chrome" | "Hardwood";
type DisplayMode = "Grid" | "Showcase" | "Compact";
type BorderStyle = "Soft" | "Chrome" | "Glow";
type FrameStyle = "Card" | "Gradient" | "Sunset" | "Stand";
type SortMode = "Newest" | "Player" | "Year";
type CardTag = "Rookie" | "Auto" | "Patch" | "Numbered" | "Favorite";
type StudioTab = "Details" | "Market" | "Display";
type AppSection =
  | "Home"
  | "Feed"
  | "Collection"
  | "Tools"
  | "Insights"
  | "Trade"
  | "Wishlist"
  | "Profile";

type Card = {
  id: string;
  player: string;
  sport: string;
  team: string;
  year: string;
  brand: string;
  set: string;
  cardNumber?: string;
  parallel?: string;
  status: "Vaulted" | "Wishlist" | "For Trade";
  grade: string;
  gradingCompany?: string;
  certNumber?: string;
  gradingFee?: string;
  storageLocation?: string;
  color: string;
  collection: string;
  imageUrl?: string;
  sourceUrl?: string;
  sourceName?: string;
  estimatedValue?: string;
  purchasePrice?: string;
  salePrice?: string;
  saleStatus?: "Holding" | "Listed" | "Sold";
  frameStyle?: FrameStyle;
  borderStyle?: BorderStyle;
  tags?: CardTag[];
  imageX?: number;
  imageY?: number;
  imageZoom?: number;
  imageRotation?: number;
  notes?: string;
  acquiredFrom?: string;
  acquiredAt?: string;
  targetPrice?: string;
  isChase?: boolean;
};

type CollectorProfile = {
  handle: string;
  bio: string;
  avatarInitials: string;
  favoritePCs: string[];
  publicCollections: string[];
};

const cardTags: CardTag[] = ["Rookie", "Auto", "Patch", "Numbered", "Favorite"];
const appSections: AppSection[] = ["Home", "Collection", "Feed", "Profile"];
const utilitySections: AppSection[] = ["Insights", "Trade", "Tools", "Wishlist"];
const accentPalette = ["#ff5533", "#38bdf8", "#20e3b2", "#f59e0b", "#ef3f6b", "#d7b46a"];

const themes: Record<ThemeName, { bg: string; panel: string; accent: string }> = {
  Arena: {
    bg: "bg-[#0b0f16]",
    panel: "bg-[#151b24]",
    accent: "#ff5533",
  },
  Chrome: {
    bg: "bg-[#071018]",
    panel: "bg-[#101a25]",
    accent: "#38d5ff",
  },
  Hardwood: {
    bg: "bg-[#10100c]",
    panel: "bg-[#19180f]",
    accent: "#d7b46a",
  },
};

const defaultCollectorProfile: CollectorProfile = {
  handle: "cardroster",
  bio: "Collector vault, trade board, and favorite pickups.",
  avatarInitials: "CR",
  favoritePCs: ["Rookie cards", "Autos", "Trade bait"],
  publicCollections: ["Main Collection"],
};

export default function Home() {
  const [theme, setTheme] = useState<ThemeName>(() => {
    if (typeof window === "undefined") return "Arena";
    return (localStorage.getItem("cardroster.theme") as ThemeName) ?? "Arena";
  });
  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => {
    if (typeof window === "undefined") return "Grid";
    return (localStorage.getItem("cardroster.displayMode") as DisplayMode) ?? "Grid";
  });
  const [borderStyle, setBorderStyle] = useState<BorderStyle>(() => {
    if (typeof window === "undefined") return "Soft";
    return readBorderStyle(localStorage.getItem("cardroster.borderStyle"));
  });
  const [frameStyle, setFrameStyle] = useState<FrameStyle>(() => {
    if (typeof window === "undefined") return "Card";
    return readFrameStyle(localStorage.getItem("cardroster.frameStyle"));
  });
  const [sortMode, setSortMode] = useState<SortMode>("Newest");
  const [query, setQuery] = useState("");
  const [sport, setSport] = useState("All");
  const [status, setStatus] = useState("All");
  const [collection, setCollection] = useState("All");
  const [tagFilter, setTagFilter] = useState<"All" | CardTag>("All");
  const [newCollection, setNewCollection] = useState("");
  const [studioTab, setStudioTab] = useState<StudioTab>("Details");
  const [detailId, setDetailId] = useState("");
  const [showcaseOpen, setShowcaseOpen] = useState(false);
  const [newChasePlayer, setNewChasePlayer] = useState("");
  const [activeSection, setActiveSection] = useState<AppSection>("Home");
  const [savedCollections, setSavedCollections] = useState<string[]>(() => {
    if (typeof window === "undefined") return ["Main Collection"];
    return JSON.parse(
      localStorage.getItem("cardroster.collections") ?? "[\"Main Collection\"]",
    );
  });
  const [collectionName, setCollectionName] = useState(() => {
    if (typeof window === "undefined") return "CardRoster Vault";
    return localStorage.getItem("cardroster.collectionName") ?? "CardRoster Vault";
  });
  const [collectorProfile, setCollectorProfile] = useState<CollectorProfile>(() => {
    if (typeof window === "undefined") return defaultCollectorProfile;
    return readCollectorProfile(localStorage.getItem("cardroster.profile"));
  });
  const [savedCards, setSavedCards] = useState<Card[]>(() => {
    if (typeof window === "undefined") return [];
    const cards = JSON.parse(localStorage.getItem("cardroster.cards") ?? "[]") as Card[];
    return cards.map((card) => ({
      ...card,
      collection: card.collection ?? "Main Collection",
      frameStyle: readFrameStyle(card.frameStyle ?? null),
      tags: sanitizeTags(card.tags),
      imageX: card.imageX ?? 50,
      imageY: card.imageY ?? 50,
      imageZoom: card.imageZoom ?? 100,
      imageRotation: card.imageRotation ?? 0,
    }));
  });
  const [selectedId, setSelectedId] = useState("");
  const [grailId, setGrailId] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("cardroster.grailId") ?? "";
  });
  const [storageUsageMB, setStorageUsageMB] = useState(() => getStorageUsageMB());
  const didLoadCards = useRef(false);

  useEffect(() => {
    localStorage.setItem("cardroster.collectionName", collectionName);
  }, [collectionName]);

  useEffect(() => {
    localStorage.setItem("cardroster.profile", JSON.stringify(collectorProfile));
  }, [collectorProfile]);

  useEffect(() => {
    localStorage.setItem("cardroster.theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("cardroster.displayMode", displayMode);
  }, [displayMode]);

  useEffect(() => {
    localStorage.setItem("cardroster.borderStyle", borderStyle);
  }, [borderStyle]);

  useEffect(() => {
    localStorage.setItem("cardroster.frameStyle", frameStyle);
  }, [frameStyle]);

  useEffect(() => {
    localStorage.setItem("cardroster.grailId", grailId);
  }, [grailId]);

  useEffect(() => {
    const refreshStorageUsage = window.setTimeout(() => {
      setStorageUsageMB(getStorageUsageMB());
    }, 0);

    return () => window.clearTimeout(refreshStorageUsage);
  }, [savedCards, savedCollections, collectionName, collectorProfile]);

  useEffect(() => {
    if (!didLoadCards.current) {
      didLoadCards.current = true;
      return;
    }

    const persistCards = window.setTimeout(() => {
      localStorage.setItem("cardroster.cards", JSON.stringify(savedCards));
    }, 250);

    return () => window.clearTimeout(persistCards);
  }, [savedCards]);

  const activeTheme = themes[theme];
  const allCards = savedCards;
  const sports = ["All", ...Array.from(new Set(allCards.map((card) => card.sport)))];
  const statuses = ["All", "Vaulted", "Wishlist", "For Trade"];
  const collections = [
    "All",
    ...Array.from(
      new Set([...savedCollections, ...allCards.map((card) => card.collection)]),
    ),
  ];
  const activeCards = allCards.filter((card) => card.saleStatus !== "Sold");
  const chaseCards = allCards.filter((card) => card.isChase);
  const inventoryValue = activeCards.reduce(
    (total, card) => total + cardValue(card),
    0,
  );
  const costBasis = activeCards.reduce(
    (total, card) => total + moneyValue(card.purchasePrice),
    0,
  );
  const soldValue = allCards.reduce(
    (total, card) => total + moneyValue(card.salePrice),
    0,
  );
  const gradedCount = allCards.filter((card) => card.grade && card.grade !== "Raw").length;
  const autoCount = allCards.filter((card) => card.tags?.includes("Auto")).length;
  const numberedCount = allCards.filter((card) => card.tags?.includes("Numbered")).length;
  const biggestCard = activeCards.toSorted((a, b) => cardValue(b) - cardValue(a))[0];
  const portfolioGain = inventoryValue - costBasis;

  const filteredCards = useMemo(() => {
    const search = query.toLowerCase().trim();

    const matches = allCards.filter((card) => {
      const matchesSearch = [
        card.player,
        card.team,
        card.year,
        card.brand,
        card.set,
        card.grade,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search);
      const matchesSport = sport === "All" || card.sport === sport;
      const matchesStatus = status === "All" || card.status === status;
      const matchesCollection =
        collection === "All" || card.collection === collection;
      const matchesTag = tagFilter === "All" || card.tags?.includes(tagFilter);

      return (
        matchesSearch &&
        matchesSport &&
        matchesStatus &&
        matchesCollection &&
        matchesTag
      );
    });

    return matches.toSorted((a, b) => {
      if (sortMode === "Player") return a.player.localeCompare(b.player);
      if (sortMode === "Year") return b.year.localeCompare(a.year);
      return 0;
    });
  }, [allCards, collection, query, sortMode, sport, status, tagFilter]);

  const selectedCard =
    allCards.find((card) => card.id === selectedId) ??
    filteredCards[0];
  const grailCard = allCards.find((card) => card.id === grailId) ?? allCards[0];
  const favoriteCards = allCards
    .filter((card) => card.tags?.includes("Favorite") && card.id !== grailCard?.id)
    .slice(0, 5);
  function deleteCard(id: string) {
    const nextCards = savedCards.filter((card) => card.id !== id);
    setSavedCards(nextCards);
    setSelectedId(nextCards[0]?.id ?? "");
  }

  function updateCard(id: string, updates: Partial<Card>) {
    const nextCards = savedCards.map((card) =>
      card.id === id ? { ...card, ...updates } : card,
    );
    setSavedCards(nextCards);
  }

  function exportCards() {
    const headers = [
      "player",
      "sport",
      "team",
      "year",
      "brand",
      "set",
      "cardNumber",
      "parallel",
      "status",
      "grade",
      "gradingCompany",
      "certNumber",
      "gradingFee",
      "collection",
      "storageLocation",
      "estimatedValue",
      "purchasePrice",
      "salePrice",
      "saleStatus",
      "acquiredFrom",
      "acquiredAt",
      "sourceUrl",
      "tags",
      "notes",
    ];
    const rows = savedCards.map((card) =>
      headers.map((header) => csvCell(card[header as keyof Card])),
    );
    const exportedAt = new Date().toISOString().slice(0, 10);
    const csv = `sep=,\r\n${[headers, ...rows].map((row) => row.join(",")).join("\r\n")}`;
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cardroster-${exportedAt}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function addCollection() {
    const cleanName = newCollection.trim();
    if (!cleanName || savedCollections.includes(cleanName)) return;

    const nextCollections = [...savedCollections, cleanName];
    setSavedCollections(nextCollections);
    localStorage.setItem("cardroster.collections", JSON.stringify(nextCollections));
    setNewCollection("");
  }

  function addChaseCard() {
    const player = newChasePlayer.trim();
    if (!player) return;

    const chaseCard: Card = {
      id: crypto.randomUUID(),
      player,
      sport: sport === "All" ? "Basketball" : sport,
      team: "Unknown Team",
      year: "Wanted",
      brand: "Chase",
      set: "Wishlist",
      status: "Wishlist",
      grade: "Raw",
      color: activeTheme.accent,
      collection: collection === "All" ? "Wishlist" : collection,
      frameStyle: "Card",
      borderStyle: "Soft",
      tags: ["Favorite"],
      imageX: 50,
      imageY: 50,
      imageZoom: 100,
      imageRotation: 0,
      isChase: true,
    };
    const nextCards = [chaseCard, ...savedCards];
    setSavedCards(nextCards);
    localStorage.setItem("cardroster.cards", JSON.stringify(nextCards));
    setSelectedId(chaseCard.id);
    setNewChasePlayer("");
  }

  return (
    <main className={`min-h-screen ${activeTheme.bg} text-white`}>
      <div className="pointer-events-none fixed inset-0 opacity-30">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:44px_44px]" />
        <div
          className="absolute left-1/2 top-0 h-48 w-1/3 -translate-x-1/2 rounded-full blur-3xl"
          style={{ backgroundColor: `${activeTheme.accent}14` }}
        />
      </div>
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/45 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div
              className="grid h-10 w-10 place-items-center rounded-md text-base font-black shadow-[0_0_24px_rgba(255,255,255,0.18)]"
              style={{ backgroundColor: activeTheme.accent }}
            >
              CR
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/55">
                CardRoster
              </p>
              <h1 className="mt-0.5 text-lg font-black tracking-normal sm:text-xl">
                {collectionName}
              </h1>
            </div>
          </div>

          <nav className="no-scrollbar hidden max-w-2xl items-center gap-1 overflow-x-auto rounded-full border border-white/10 bg-white/[0.04] p-1 text-xs font-bold text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] md:flex">
            {appSections.map((section) => (
              <button
                key={section}
                onClick={() => setActiveSection(section)}
                className={`rounded-full px-3.5 py-1.5 transition ${
                  activeSection === section
                    ? "bg-white text-[#111722]"
                    : "hover:bg-white/10"
                }`}
              >
                {section}
              </button>
            ))}
            <select
              aria-label="More sections"
              value={utilitySections.includes(activeSection) ? activeSection : ""}
              onChange={(event) => {
                if (event.target.value) setActiveSection(event.target.value as AppSection);
              }}
              className={`h-7 rounded-full border border-white/10 px-3 text-xs font-bold outline-none ${
                utilitySections.includes(activeSection)
                  ? "bg-white text-[#111722]"
                  : "bg-transparent text-slate-200 hover:bg-white/10"
              }`}
            >
              <option value="">More</option>
              {utilitySections.map((section) => (
                <option key={section} value={section}>
                  {section}
                </option>
              ))}
            </select>
            <Link className="rounded-full px-3.5 py-1.5 hover:bg-white/10" href="/upload">
              Upload
            </Link>
          </nav>
        </div>
        <nav className="no-scrollbar flex gap-2 overflow-x-auto border-t border-white/5 px-4 py-2 text-xs font-black text-slate-300 md:hidden">
          {[...appSections, "Upload"].map((section) =>
            section === "Upload" ? (
              <Link
                key={section}
                href="/upload"
                className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5"
              >
                Upload
              </Link>
            ) : (
              <button
                key={section}
                onClick={() => setActiveSection(section as AppSection)}
                className={`shrink-0 rounded-full border px-3 py-1.5 ${
                  activeSection === section
                    ? "border-white/20 bg-white text-[#111722]"
                    : "border-white/10 bg-white/5"
                }`}
              >
                {section}
              </button>
            ),
          )}
        </nav>
      </header>

      {activeSection === "Home" ? (
        <CollectorHome
          accent={activeTheme.accent}
          allCards={allCards}
          collectionName={collectionName}
          favoriteCards={favoriteCards}
          grailCard={grailCard}
          onOpenCard={(card) => setDetailId(card.id)}
          onOpenCollection={() => setActiveSection("Collection")}
          onOpenShowcase={() => setShowcaseOpen(true)}
        />
      ) : null}

      {activeSection === "Feed" ? (
        <PublicFeed
          accent={activeTheme.accent}
          cards={allCards}
          collectionName={collectionName}
          profile={collectorProfile}
          onOpenCard={(card) => setDetailId(card.id)}
          onOpenCollection={() => setActiveSection("Collection")}
        />
      ) : null}

      {activeSection === "Tools" ? (
        <CollectorWorkbench
          accent={activeTheme.accent}
          cards={allCards}
          collectionName={collectionName}
          onExport={exportCards}
          onOpenCard={(card) => setDetailId(card.id)}
          onOpenCollection={() => setActiveSection("Collection")}
        />
      ) : null}

      {activeSection === "Trade" ? (
        <TradeBrowse
          accent={activeTheme.accent}
          cards={allCards}
          onOpenCard={(card) => setDetailId(card.id)}
          onOpenCollection={() => setActiveSection("Collection")}
        />
      ) : null}

      {activeSection === "Insights" ? (
        <InsightsHome
          accent={activeTheme.accent}
          allCards={allCards}
          autoCount={autoCount}
          biggestCard={biggestCard}
          chaseCards={chaseCards}
          costBasis={costBasis}
          favoriteCards={favoriteCards}
          gradedCount={gradedCount}
          inventoryValue={inventoryValue}
          numberedCount={numberedCount}
          onOpenCard={(card) => setDetailId(card.id)}
          onOpenCollection={() => setActiveSection("Collection")}
          portfolioGain={portfolioGain}
          soldValue={soldValue}
        />
      ) : null}

      {(activeSection === "Wishlist" || activeSection === "Profile") ? (
        <PlatformPreview
          accent={activeTheme.accent}
          allCards={allCards}
          collectionName={collectionName}
          collections={collections.filter((item) => item !== "All")}
          favoriteCards={favoriteCards}
          onProfileChange={setCollectorProfile}
          section={activeSection}
          profile={collectorProfile}
          onBack={() => setActiveSection("Home")}
        />
      ) : null}

      {activeSection === "Collection" ? (
        <>
      <section className="mx-auto max-w-[1680px] px-4 py-4 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.08),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015))] p-4 shadow-2xl sm:p-5">
          <div
            className="absolute inset-x-0 top-0 h-1"
            style={{ backgroundColor: activeTheme.accent }}
          />
          <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-stretch">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-white/55">
                Collection
              </p>
              <h2 className="mt-2 max-w-3xl text-3xl font-black leading-tight tracking-normal sm:text-4xl">
                {collectionName}
              </h2>
              <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-slate-400">
                Browse, tune, value, and share cards from one focused vault view.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href="/upload"
                  className="inline-flex h-10 items-center rounded-md px-4 text-sm font-black text-white shadow-lg transition hover:brightness-110"
                  style={{ backgroundColor: activeTheme.accent }}
                >
                  Upload cards
                </Link>
                <button
                  onClick={() => setShowcaseOpen(true)}
                  disabled={allCards.length === 0}
                  className="inline-flex h-10 items-center rounded-md border border-white/10 bg-white/5 px-4 text-sm font-black text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Showcase
                </button>
              </div>
              <div className="mt-5 grid max-w-2xl gap-2 sm:grid-cols-4">
                <HeroMetric label="Cards saved" value={allCards.length.toString()} />
                <HeroMetric
                  label="Collection value"
                  value={formatMoney(inventoryValue)}
                />
                <HeroMetric label="Total spent" value={formatMoney(costBasis)} />
                <HeroMetric label="Sold" value={formatMoney(soldValue)} />
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/30 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                  Vault settings
                </p>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black text-slate-300">
                  Local
                </span>
              </div>
              <label className="mt-4 block text-xs font-bold text-slate-200">
                Collection name
              </label>
              <input
                value={collectionName}
                onChange={(event) => setCollectionName(event.target.value)}
                className="mt-1.5 h-9 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-white/40"
              />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <MiniStat label="Cards" value={allCards.length.toString()} />
                <MiniStat label="Vaults" value={(collections.length - 1).toString()} />
                <MiniStat label="Favorites" value={(favoriteCards.length + (grailCard ? 1 : 0)).toString()} />
                <MiniStat label="Chases" value={chaseCards.length.toString()} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setActiveSection("Profile")}
                  className="h-9 rounded-md border border-white/10 bg-white/5 text-xs font-black text-slate-200 hover:bg-white/10"
                >
                  Profile
                </button>
                <button
                  onClick={() => setActiveSection("Feed")}
                  className="h-9 rounded-md border border-white/10 bg-white/5 text-xs font-black text-slate-200 hover:bg-white/10"
                >
                  Feed
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1680px] gap-4 px-4 pb-8 sm:px-6 xl:grid-cols-[190px_minmax(0,1fr)_300px]">
        <aside className={`h-fit max-h-[calc(100vh-5.5rem)] overflow-y-auto rounded-xl border border-white/10 ${activeTheme.panel} p-3 shadow-xl lg:sticky lg:top-20`}>
          <RailSection title="Find">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-9 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-white/40"
              placeholder="Player, team, year..."
            />
          </RailSection>

          <RailSection title="Filter">
            <div className="grid gap-2">
              <FilterSelect label="Collection" value={collection} onChange={setCollection} options={collections} />
              <FilterSelect label="Sport" value={sport} onChange={setSport} options={sports} />
              <FilterSelect label="Status" value={status} onChange={setStatus} options={statuses} />
              <FilterSelect
                label="Tag"
                value={tagFilter}
                onChange={(value) => setTagFilter(value as "All" | CardTag)}
                options={["All", ...cardTags]}
              />
            </div>
          </RailSection>

          <RailSection title="Add">
            <details className="group rounded-lg border border-white/10 bg-black/15 p-2">
              <summary className="cursor-pointer list-none text-sm font-black text-sky-100 group-open:text-white">
                Vault tools
              </summary>
              <div className="mt-3 grid gap-3">
                <div className="grid gap-2">
                  <input
                    value={newCollection}
                    onChange={(event) => setNewCollection(event.target.value)}
                    className="h-9 rounded-md border border-white/10 bg-black/30 px-3 text-xs font-bold text-white outline-none placeholder:text-slate-500 focus:border-white/40"
                    placeholder="New collection"
                  />
                  <button
                    onClick={addCollection}
                    className="h-8 rounded-md border border-white/10 bg-white/5 text-xs font-black text-slate-200 hover:bg-white/10"
                  >
                    Add collection
                  </button>
                </div>
                <div className="grid gap-2 border-t border-white/10 pt-3">
                  <input
                    value={newChasePlayer}
                    onChange={(event) => setNewChasePlayer(event.target.value)}
                    className="h-9 rounded-md border border-white/10 bg-black/30 px-3 text-xs font-bold text-white outline-none placeholder:text-slate-500 focus:border-white/40"
                    placeholder="Card to chase"
                  />
                  <button
                    onClick={addChaseCard}
                    className="h-8 rounded-md border border-white/10 bg-white/5 text-xs font-black text-slate-200 hover:bg-white/10"
                  >
                    Add wishlist
                  </button>
                </div>
              </div>
            </details>
          </RailSection>

          <RailSection title="Look">
            <details className="group rounded-lg border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-2" open>
              <summary className="cursor-pointer list-none text-sm font-black text-sky-100 group-open:text-white">
                Customization
              </summary>
              <div className="mt-3 grid gap-2">
                <FilterSelect
                  label="Theme"
                  value={theme}
                  onChange={(value) => setTheme(value as ThemeName)}
                  options={["Arena", "Chrome", "Hardwood"]}
                />
                <FilterSelect
                  label="Frame"
                  value={frameStyle}
                  onChange={(value) => setFrameStyle(value as FrameStyle)}
                  options={["Card", "Gradient", "Sunset", "Stand"]}
                />
                <FilterSelect
                  label="Finish"
                  value={borderStyle}
                  onChange={(value) => setBorderStyle(value as BorderStyle)}
                  options={["Soft", "Chrome", "Glow"]}
                />
                <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                    Accent
                  </p>
                  <div className="grid grid-cols-6 gap-1.5">
                    {accentPalette.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => selectedCard ? updateCard(selectedCard.id, { color }) : undefined}
                        className={`h-6 rounded-md border transition ${
                          selectedCard?.color === color
                            ? "border-white shadow-[0_0_0_2px_rgba(255,85,51,0.25)]"
                            : "border-white/15 hover:border-white/40"
                        }`}
                        style={{ backgroundColor: color }}
                        aria-label={`Use ${color} accent`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </details>
          </RailSection>
        </aside>

        <section className="min-w-0 rounded-xl border border-white/10 bg-black/15 p-3 shadow-2xl">
          <CollectionQuickNav
            accent={activeTheme.accent}
            activeLabel={tagFilter === "Favorite" ? "Favorites" : status}
            counts={{
              all: allCards.length,
              favorites: favoriteCards.length + (grailCard ? 1 : 0),
              trade: allCards.filter((card) => card.status === "For Trade").length,
              wishlist: allCards.filter((card) => card.status === "Wishlist").length,
            }}
            onAll={() => {
              setCollection("All");
              setStatus("All");
              setTagFilter("All");
            }}
            onFavorites={() => {
              setStatus("All");
              setTagFilter("Favorite");
            }}
            onTrade={() => {
              setTagFilter("All");
              setStatus("For Trade");
            }}
            onWishlist={() => {
              setTagFilter("All");
              setStatus("Wishlist");
            }}
          />

          {storageUsageMB > 40 ? (
            <div className="mb-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 shadow-[0_0_30px_rgba(245,158,11,0.08)]">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-300">
                Storage warning
              </p>
              <p className="mt-1 text-sm font-bold text-amber-100">
                Collection storage is getting full ({storageUsageMB.toFixed(1)}mb / ~50mb).
                Move to cloud storage to keep adding cards.
              </p>
            </div>
          ) : null}

          {grailCard ? (
            <GrailDisplay
              accent={activeTheme.accent}
              borderStyle={grailCard.borderStyle ?? "Soft"}
              card={grailCard}
              frameStyle="Stand"
              onSelect={() => setSelectedId(grailCard.id)}
            />
          ) : null}

          {allCards.length > 0 ? (
            <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <GalleryStat label="Shown" value={filteredCards.length.toString()} />
              <GalleryStat label="Vault" value={collection === "All" ? "All" : collection} />
              <GalleryStat label="Sort" value={sortMode} />
              <GalleryStat label="View" value={displayMode} />
            </div>
          ) : null}

          <div className="mb-3 flex flex-col justify-between gap-3 rounded-xl border border-white/10 bg-[linear-gradient(135deg,rgba(21,27,38,0.92),rgba(8,12,18,0.92))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:flex-row sm:items-center">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/55">
                Gallery
              </p>
              <h3 className="mt-1 text-xl font-black">
                {collection === "All" ? "Full roster" : collection}
              </h3>
              <p className="mt-1 text-xs font-bold text-slate-500">
                {filteredCards.length} card{filteredCards.length === 1 ? "" : "s"} shown
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                className="h-9 rounded-md border border-white/10 bg-[#111722] px-3 text-xs font-black text-white outline-none"
              >
                <option>Newest</option>
                <option>Player</option>
                <option>Year</option>
              </select>
              {(["Grid", "Showcase", "Compact"] as DisplayMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setDisplayMode(mode)}
                  className={`h-9 rounded-lg px-3 text-xs font-black transition ${
                    displayMode === mode
                      ? "bg-[#ff5533] text-white shadow-[0_0_30px_rgba(255,85,51,0.15)]"
                      : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {allCards.length === 0 ? (
            <EmptyGallery
                accent={activeTheme.accent}
                displayMode={displayMode}
                onDisplayChange={setDisplayMode}
                borderStyle={borderStyle}
                frameStyle={frameStyle}
              />
          ) : filteredCards.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-[#151b26] p-7 text-center text-slate-400">
              No cards match those filters.
            </div>
          ) : (
            <div className={displayModeClasses(displayMode)}>
              {filteredCards.map((card) => (
                <CardTile
                  key={card.id}
                  card={card}
                  accent={activeTheme.accent}
                  borderStyle={card.borderStyle ?? borderStyle}
                  mode={displayMode}
                  selected={selectedCard?.id === card.id}
                  onClick={() => setSelectedId(card.id)}
                  onDoubleClick={() => setDetailId(card.id)}
                />
              ))}
            </div>
          )}
        </section>

        <aside className={`h-fit rounded-xl border border-white/10 ${activeTheme.panel} p-3 shadow-xl lg:sticky lg:top-20`}>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/55">
              Card studio
            </p>
            {selectedCard ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black text-slate-300">
                Live edit
              </span>
            ) : null}
          </div>
          {selectedCard ? (
            <>
              <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015))] shadow-[0_18px_45px_rgba(0,0,0,0.32)]">
                <button
                  onClick={() => setDetailId(selectedCard.id)}
                  className="block w-full p-3 text-left"
                >
                  <div className="h-[250px] rounded-xl bg-black/20 p-3">
                    <CardPreview
                      key={`${selectedCard.id}-${selectedCard.imageX ?? 50}-${selectedCard.imageY ?? 50}-${selectedCard.imageZoom ?? 100}-${selectedCard.imageRotation ?? 0}`}
                      card={selectedCard}
                      accent={activeTheme.accent}
                      borderStyle={borderStyle}
                      frameStyle={selectedCard.frameStyle ?? frameStyle}
                      imageFit="contain"
                      large
                    />
                  </div>
                  <div className="mt-3 min-w-0">
                    <p className="truncate text-lg font-black text-white">{selectedCard.player}</p>
                    <p className="mt-1 truncate text-xs font-bold text-slate-400">
                      {cardSubtitle(selectedCard)}
                    </p>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <MiniStat
                      label="Value"
                      value={formatMoney(cardValue(selectedCard))}
                    />
                    <MiniStat label="Grade" value={selectedCard.grade || "Raw"} />
                    <MiniStat label="Status" value={selectedCard.status} />
                  </div>
                </button>
              </div>
              <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="mb-3 grid grid-cols-3 gap-1 rounded-lg border border-white/10 bg-black/25 p-1">
                  {(["Details", "Market", "Display"] as StudioTab[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setStudioTab(tab)}
                      className={`h-8 flex-1 rounded-md text-[11px] font-black transition ${
                        studioTab === tab
                          ? "bg-[#ff5533] text-white"
                          : "text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                {studioTab === "Details" ? (
                  <div className="grid gap-2">
                    <EditField label="Player">
                      <input value={selectedCard.player} onChange={(event) => updateCard(selectedCard.id, { player: event.target.value })} className="studio-field" />
                    </EditField>
                    <div className="grid grid-cols-2 gap-2">
                      <EditField label="Team">
                        <input value={selectedCard.team} onChange={(event) => updateCard(selectedCard.id, { team: event.target.value })} className="studio-field" />
                      </EditField>
                      <EditField label="Year">
                        <input value={selectedCard.year} onChange={(event) => updateCard(selectedCard.id, { year: event.target.value })} className="studio-field" />
                      </EditField>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <EditField label="Brand">
                        <input value={selectedCard.brand} onChange={(event) => updateCard(selectedCard.id, { brand: event.target.value })} className="studio-field" />
                      </EditField>
                      <EditField label="Set">
                        <input value={selectedCard.set} onChange={(event) => updateCard(selectedCard.id, { set: event.target.value })} className="studio-field" />
                      </EditField>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <EditField label="Card #">
                        <input value={selectedCard.cardNumber ?? ""} onChange={(event) => updateCard(selectedCard.id, { cardNumber: event.target.value })} className="studio-field" placeholder="#144" />
                      </EditField>
                      <EditField label="Parallel">
                        <input value={selectedCard.parallel ?? ""} onChange={(event) => updateCard(selectedCard.id, { parallel: event.target.value })} className="studio-field" placeholder="Refractor, holo..." />
                      </EditField>
                    </div>
                    <EditField label="Collection">
                      <select value={selectedCard.collection} onChange={(event) => updateCard(selectedCard.id, { collection: event.target.value })} className="studio-field">
                        {collections.filter((item) => item !== "All").map((item) => <option key={item}>{item}</option>)}
                      </select>
                    </EditField>
                    <EditField label="Status">
                      <select value={selectedCard.status} onChange={(event) => updateCard(selectedCard.id, { status: event.target.value as Card["status"] })} className="studio-field">
                        <option>Vaulted</option>
                        <option>Wishlist</option>
                        <option>For Trade</option>
                      </select>
                    </EditField>
                    <details className="rounded-lg border border-white/10 bg-black/20 p-3">
                      <summary className="cursor-pointer list-none text-xs font-black text-slate-200">
                        Storage and grading
                      </summary>
                      <div className="mt-3 grid gap-2">
                        <div className="grid grid-cols-2 gap-2">
                          <EditField label="Location">
                            <input value={selectedCard.storageLocation ?? ""} onChange={(event) => updateCard(selectedCard.id, { storageLocation: event.target.value })} className="studio-field" placeholder="Box A" />
                          </EditField>
                          <EditField label="Cert #">
                            <input value={selectedCard.certNumber ?? ""} onChange={(event) => updateCard(selectedCard.id, { certNumber: event.target.value })} className="studio-field" placeholder="Cert" />
                          </EditField>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <EditField label="Grader">
                            <input value={selectedCard.gradingCompany ?? ""} onChange={(event) => updateCard(selectedCard.id, { gradingCompany: event.target.value })} className="studio-field" placeholder="PSA" />
                          </EditField>
                          <EditField label="Fee">
                            <input value={selectedCard.gradingFee ?? ""} onChange={(event) => updateCard(selectedCard.id, { gradingFee: event.target.value })} className="studio-field" placeholder="$25" />
                          </EditField>
                        </div>
                        <CardResearchPanel card={selectedCard} />
                      </div>
                    </details>
                    <EditField label="Notes">
                      <textarea value={selectedCard.notes ?? ""} onChange={(event) => updateCard(selectedCard.id, { notes: event.target.value })} className="studio-field min-h-20 py-2" placeholder="Why this card matters, where it came from, condition notes..." />
                    </EditField>
                  </div>
                ) : null}
                {studioTab === "Display" ? (
                  <div className="grid gap-2">
                    <div className="grid grid-cols-2 gap-2">
                      <EditField label="Frame">
                        <select value={selectedCard.frameStyle ?? frameStyle} onChange={(event) => updateCard(selectedCard.id, { frameStyle: event.target.value as FrameStyle })} className="studio-field">
                          <option>Card</option>
                          <option>Gradient</option>
                          <option>Sunset</option>
                          <option>Stand</option>
                        </select>
                      </EditField>
                      <EditField label="Finish">
                        <select value={selectedCard.borderStyle ?? borderStyle} onChange={(event) => updateCard(selectedCard.id, { borderStyle: event.target.value as BorderStyle })} className="studio-field">
                          <option>Soft</option>
                          <option>Chrome</option>
                          <option>Glow</option>
                        </select>
                      </EditField>
                    </div>
                    <EditField label="Frame color">
                      <input value={selectedCard.color} onChange={(event) => updateCard(selectedCard.id, { color: event.target.value })} className="studio-field" type="color" />
                    </EditField>
                    <ColorSwatches
                      activeColor={selectedCard.color}
                      onChange={(color) => updateCard(selectedCard.id, { color })}
                    />
                    <EditField label="Tags">
                      <div className="flex flex-wrap gap-2">
                        {cardTags.map((tag) => {
                          const active = selectedCard.tags?.includes(tag) ?? false;
                          return (
                            <button key={tag} type="button" onClick={() => updateCard(selectedCard.id, { tags: toggleTag(selectedCard.tags, tag) })} className={`h-8 rounded-full px-3 text-[11px] font-black transition ${active ? "bg-[#ff5533] text-white" : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}>
                              {tag}
                            </button>
                          );
                        })}
                      </div>
                    </EditField>
                    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                      <p className="mb-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                        Crop
                      </p>
                      <div className="grid gap-3">
                      <RangeField label="Horizontal" value={selectedCard.imageX ?? 50} onChange={(value) => updateCard(selectedCard.id, { imageX: value })} />
                      <RangeField label="Vertical" value={selectedCard.imageY ?? 50} onChange={(value) => updateCard(selectedCard.id, { imageY: value })} />
                      <RangeField label="Zoom" min={100} max={150} value={selectedCard.imageZoom ?? 100} onChange={(value) => updateCard(selectedCard.id, { imageZoom: value })} />
                      <RangeField label="Rotate" min={-180} max={180} value={selectedCard.imageRotation ?? 0} onChange={(value) => updateCard(selectedCard.id, { imageRotation: value })} />
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                      <button type="button" onClick={() => updateCard(selectedCard.id, { imageRotation: rotateValue(selectedCard.imageRotation ?? 0, -90) })} className="h-8 rounded-md border border-white/10 bg-white/5 text-xs font-black text-slate-200 hover:bg-white/10">
                        Left
                      </button>
                      <button type="button" onClick={() => updateCard(selectedCard.id, { imageRotation: rotateValue(selectedCard.imageRotation ?? 0, 90) })} className="h-8 rounded-md border border-white/10 bg-white/5 text-xs font-black text-slate-200 hover:bg-white/10">
                        Right
                      </button>
                      <button type="button" onClick={() => updateCard(selectedCard.id, { imageX: 50, imageY: 50, imageZoom: 100, imageRotation: 0 })} className="h-8 rounded-md border border-white/10 bg-white/5 text-xs font-black text-slate-200 hover:bg-white/10">
                        Reset
                      </button>
                      </div>
                    </div>
                  </div>
                ) : null}
                {studioTab === "Market" ? (
                  <div className="grid gap-2">
                    <div className="grid grid-cols-2 gap-2">
                      <EditField label="Value">
                        <input value={selectedCard.estimatedValue ?? ""} onChange={(event) => updateCard(selectedCard.id, { estimatedValue: event.target.value })} className="studio-field" placeholder="$0" />
                      </EditField>
                      <EditField label="Cost">
                        <input value={selectedCard.purchasePrice ?? ""} onChange={(event) => updateCard(selectedCard.id, { purchasePrice: event.target.value })} className="studio-field" placeholder="$0" />
                      </EditField>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <EditField label="Sale status">
                        <select value={selectedCard.saleStatus ?? "Holding"} onChange={(event) => updateCard(selectedCard.id, { saleStatus: event.target.value as Card["saleStatus"] })} className="studio-field">
                          <option>Holding</option>
                          <option>Listed</option>
                          <option>Sold</option>
                        </select>
                      </EditField>
                      <EditField label="Sold for">
                        <input value={selectedCard.salePrice ?? ""} onChange={(event) => updateCard(selectedCard.id, { salePrice: event.target.value })} className="studio-field" placeholder="$0" />
                      </EditField>
                    </div>
                    <EditField label="Acquired from">
                      <input value={selectedCard.acquiredFrom ?? ""} onChange={(event) => updateCard(selectedCard.id, { acquiredFrom: event.target.value })} className="studio-field" placeholder="Shop, trade, eBay, show..." />
                    </EditField>
                    <EditField label="Target price">
                      <input value={selectedCard.targetPrice ?? ""} onChange={(event) => updateCard(selectedCard.id, { targetPrice: event.target.value })} className="studio-field" placeholder="Wishlist target" />
                    </EditField>
                    <SoldComps
                      card={selectedCard}
                      compact
                      onValueAccepted={(value) =>
                        updateCard(selectedCard.id, {
                          estimatedValue: formatMoney(value),
                        })
                      }
                    />
                  </div>
                ) : null}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => setGrailId(selectedCard.id)} className="h-9 rounded-md border border-white/10 bg-white/5 text-xs font-black text-slate-200 hover:bg-white/10">
                  Feature
                </button>
                {selectedCard.sourceUrl ? (
                  <a href={selectedCard.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center justify-center rounded-md border border-white/10 bg-white/5 text-xs font-black text-slate-200 hover:bg-white/10">
                    Source
                  </a>
                ) : (
                  <button disabled className="h-9 rounded-md border border-white/10 bg-white/[0.03] text-xs font-black text-slate-600">
                    Source
                  </button>
                )}
              </div>
              <button
                onClick={() => deleteCard(selectedCard.id)}
                className="mt-3 h-9 w-full rounded-md border border-red-400/20 bg-red-500/10 text-xs font-bold text-red-200 hover:bg-red-500/20"
              >
                Delete card
              </button>
            </>
          ) : (
            <div className="mt-4 space-y-3">
              <QuickPanel label="Select a card" value="Edit style" />
              <QuickPanel label="Global theme" value={theme} />
              <QuickPanel label="Global frame" value={frameStyle} />
            </div>
          )}
        </aside>
      </section>
        </>
      ) : null}
      {detailId ? (
        <CardDetailModal
          accent={activeTheme.accent}
          borderStyle={borderStyle}
          card={allCards.find((card) => card.id === detailId) ?? selectedCard}
          frameStyle={frameStyle}
          onClose={() => setDetailId("")}
          onNext={() => {
            const currentIndex = filteredCards.findIndex((card) => card.id === detailId);
            const nextCard = filteredCards[(currentIndex + 1) % filteredCards.length];
            if (nextCard) setDetailId(nextCard.id);
          }}
          onPrevious={() => {
            const currentIndex = filteredCards.findIndex((card) => card.id === detailId);
            const nextCard =
              filteredCards[(currentIndex - 1 + filteredCards.length) % filteredCards.length];
            if (nextCard) setDetailId(nextCard.id);
          }}
        />
      ) : null}
      {showcaseOpen ? (
        <ShowcaseOverlay
          accent={activeTheme.accent}
          borderStyle={borderStyle}
          cards={filteredCards.length ? filteredCards : allCards}
          frameStyle={frameStyle}
          onClose={() => setShowcaseOpen(false)}
        />
      ) : null}
    </main>
  );
}

function displayModeClasses(mode: DisplayMode) {
  if (mode === "Compact") {
    return "grid gap-1 overflow-hidden rounded-xl border border-white/10 bg-[#0d111a]";
  }

  if (mode === "Showcase") {
    return "grid gap-4";
  }

  return "grid auto-rows-fr gap-5 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]";
}

function CollectionQuickNav({
  accent,
  activeLabel,
  counts,
  onAll,
  onFavorites,
  onTrade,
  onWishlist,
}: {
  accent: string;
  activeLabel: string;
  counts: { all: number; favorites: number; trade: number; wishlist: number };
  onAll: () => void;
  onFavorites: () => void;
  onTrade: () => void;
  onWishlist: () => void;
}) {
  const items = [
    { count: counts.all, label: "All", onClick: onAll },
    { count: counts.favorites, label: "Favorites", onClick: onFavorites },
    { count: counts.trade, label: "For Trade", onClick: onTrade },
    { count: counts.wishlist, label: "Wishlist", onClick: onWishlist },
  ];

  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.015))] p-3">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
            Browse by intent
          </p>
          <p className="mt-1 text-sm font-bold text-slate-300">
            Jump between your main roster, favorites, trades, and chase cards.
          </p>
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {items.map((item) => {
            const active = activeLabel === item.label || (item.label === "All" && activeLabel === "All");

            return (
              <button
                key={item.label}
                onClick={item.onClick}
                className={`flex h-10 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-black transition ${
                  active
                    ? "border-white/20 text-white"
                    : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
                style={active ? { backgroundColor: accent } : undefined}
              >
                <span>{item.label}</span>
                <span className="rounded-full bg-black/25 px-2 py-0.5 text-[10px] text-white">
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CollectorHome({
  accent,
  allCards,
  collectionName,
  favoriteCards,
  grailCard,
  onOpenCard,
  onOpenCollection,
  onOpenShowcase,
}: {
  accent: string;
  allCards: Card[];
  collectionName: string;
  favoriteCards: Card[];
  grailCard?: Card;
  onOpenCard: (card: Card) => void;
  onOpenCollection: () => void;
  onOpenShowcase: () => void;
}) {
  const shelfCards = [grailCard, ...favoriteCards]
    .filter((card): card is Card => Boolean(card))
    .filter((card, index, cards) => cards.findIndex((item) => item.id === card.id) === index)
    .slice(0, 5);
  const communityCards = allCards.slice(0, 6);
  const heroCards = shelfCards.length ? shelfCards.slice(0, 4) : allCards.slice(0, 4);

  return (
    <section className="mx-auto grid max-w-[1440px] gap-4 px-4 py-4 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_12%_18%,rgba(255,255,255,0.13),transparent_26%),radial-gradient(circle_at_78%_18%,rgba(56,213,255,0.13),transparent_24%),linear-gradient(135deg,rgba(255,255,255,0.075),rgba(255,255,255,0.018))] p-5 shadow-2xl sm:p-6">
        <div
          className="absolute inset-x-0 top-0 h-1.5"
          style={{ background: `linear-gradient(90deg, ${accent}, #f8e71c, #20e3b2, #38bdf8, #ec4899)` }}
        />
        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(520px,1fr)] xl:items-center">
          <div className="py-2">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
              CardRoster social vault
            </p>
            <h2 className="mt-3 max-w-4xl text-4xl font-black leading-[1.02] sm:text-6xl">
              Your card room, built to browse.
            </h2>
            <p className="mt-4 max-w-2xl text-sm font-bold leading-6 text-slate-300">
              Showcase grails, organize vaults, save chases, and make your collection feel public-ready without turning it into a spreadsheet.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                onClick={onOpenCollection}
                className="h-11 rounded-lg px-5 text-sm font-black text-white shadow-lg transition hover:brightness-110"
                style={{ backgroundColor: accent }}
              >
                Open collection
              </button>
              <button
                onClick={onOpenShowcase}
                disabled={allCards.length === 0}
                className="h-11 rounded-lg border border-white/10 bg-white/5 px-5 text-sm font-black text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Launch showcase
              </button>
            </div>
            <div className="mt-6 grid max-w-xl gap-2 sm:grid-cols-3">
              <SocialStat label="Cards" value={allCards.length.toString()} />
              <SocialStat label="Public vaults" value={allCards.length ? "1" : "0"} />
              <SocialStat label="Trade links" value="Ready" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_1.1fr]">
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                Featured grail
              </p>
              {grailCard ? (
                <button onClick={() => onOpenCard(grailCard)} className="mt-4 w-full text-left">
                  <div className="mx-auto h-[310px] max-w-60">
                    <CardPreview
                      accent={accent}
                      borderStyle={grailCard.borderStyle ?? "Soft"}
                      card={grailCard}
                      frameStyle={grailCard.frameStyle ?? "Stand"}
                      large
                      imageFit="contain"
                    />
                  </div>
                  <p className="mt-4 truncate text-xl font-black text-white">{grailCard.player}</p>
                  <p className="line-clamp-2 text-sm font-bold leading-5 text-slate-400">
                    {grailCard.year} {grailCard.brand} {grailCard.set}
                  </p>
                </button>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-white/10 p-6 text-sm font-bold text-slate-400">
                  Upload cards to build your first exhibit.
                </div>
              )}
            </div>
            <div className="grid gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Mini wall
                </p>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {heroCards.map((card) => (
                    <button
                      key={card.id}
                      onClick={() => onOpenCard(card)}
                      className="h-32 rounded-xl border border-white/10 bg-white/[0.03] p-2 transition hover:-translate-y-0.5 hover:border-white/25"
                    >
                      <MiniWallPreview card={card} accent={accent} />
                    </button>
                  ))}
                  {heroCards.length === 0 ? (
                    <div className="col-span-4 rounded-xl border border-dashed border-white/10 p-4 text-xs font-bold text-slate-400">
                      Your first uploads will appear here.
                    </div>
                  ) : null}
                </div>
              </div>
              <CollectorProfileCard collectionName={collectionName} cardCount={allCards.length} accent={accent} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(21,27,36,0.98),rgba(10,14,20,0.98))] p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                Showcase shelf
              </p>
              <h3 className="mt-1 text-2xl font-black">{collectionName}</h3>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black text-slate-300">
              {allCards.length} cards
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {shelfCards.map((card) => (
              <button
                key={card.id}
                onClick={() => onOpenCard(card)}
                className="rounded-xl border border-white/10 bg-black/20 p-3 text-left transition hover:-translate-y-0.5 hover:border-white/25"
              >
                <div className="mx-auto h-48">
                  <CardPreview
                    accent={accent}
                    borderStyle={card.borderStyle ?? "Soft"}
                    card={card}
                    frameStyle={card.frameStyle ?? "Card"}
                    imageFit="contain"
                  />
                </div>
                <p className="mt-3 truncate text-sm font-black text-white">{card.player}</p>
                <p className="truncate text-xs font-bold text-slate-500">{card.collection}</p>
              </button>
            ))}
            {shelfCards.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 p-6 text-sm font-bold text-slate-400">
                Favorite a card to fill the shelf.
              </div>
            ) : null}
          </div>
        </div>
        <div className="grid gap-3">
          <ExperienceTile title="Seller links" copy="Attach listings to cards marked for sale or trade." />
          <ExperienceTile title="Proof badges" copy="Add purchase links, card-back photos, and verified ownership signals." />
          <ExperienceTile title="Collector feed" copy="Follow vaults, like grails, and browse themed collections." />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-2xl border border-white/10 bg-[#151b24] p-4 shadow-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                Community feed preview
              </p>
              <h3 className="mt-1 text-2xl font-black">Scroll-worthy collections</h3>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black text-slate-300">
              Public feed
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {communityCards.map((card) => (
              <button
                key={card.id}
                onClick={() => onOpenCard(card)}
                className="rounded-xl border border-white/10 bg-black/20 p-3 text-left transition hover:-translate-y-0.5 hover:border-white/25"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="grid h-9 w-9 place-items-center rounded-full text-xs font-black"
                    style={{ backgroundColor: card.color || accent }}
                  >
                    CR
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-white">{card.player}</p>
                    <p className="truncate text-xs font-bold text-slate-500">
                      from {card.collection}
                    </p>
                  </div>
                </div>
                <div className="mt-3 h-52">
                  <CardPreview
                    accent={accent}
                    borderStyle={card.borderStyle ?? "Soft"}
                    card={card}
                    frameStyle={card.frameStyle ?? "Card"}
                    imageFit="contain"
                  />
                </div>
                <div className="mt-3 flex gap-2">
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-black text-slate-300">
                    Like
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-black text-slate-300">
                    Comment
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-black text-slate-300">
                    Trade?
                  </span>
                </div>
              </button>
            ))}
            {communityCards.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 p-6 text-sm font-bold text-slate-400">
                Upload cards to start your public feed.
              </div>
            ) : null}
          </div>
        </div>
        <aside className="grid gap-4">
          <CollectorSearchPanel accent={accent} />
          <SafetyPanel />
        </aside>
      </div>
    </section>
  );
}

function TradeBrowse({
  accent,
  cards,
  onOpenCard,
  onOpenCollection,
}: {
  accent: string;
  cards: Card[];
  onOpenCard: (card: Card) => void;
  onOpenCollection: () => void;
}) {
  const [tradeQuery, setTradeQuery] = useState("");
  const [tradeSport, setTradeSport] = useState("All");
  const tradeCards = cards.filter((card) => card.status === "For Trade");
  const sports = ["All", ...Array.from(new Set(tradeCards.map((card) => card.sport)))];
  const search = tradeQuery.toLowerCase().trim();
  const filteredTradeCards = tradeCards.filter((card) => {
    const matchesSearch = [card.player, card.team, card.year, card.brand, card.set]
      .join(" ")
      .toLowerCase()
      .includes(search);
    const matchesSport = tradeSport === "All" || card.sport === tradeSport;

    return matchesSearch && matchesSport;
  });

  return (
    <section className="mx-auto grid max-w-[1440px] gap-4 px-4 py-4 sm:px-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="grid gap-4">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_12%_0%,rgba(255,255,255,0.12),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.075),rgba(255,255,255,0.014))] p-5 shadow-2xl">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
            Trade floor
          </p>
          <div className="mt-2 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <h2 className="max-w-3xl text-4xl font-black leading-tight sm:text-5xl">
                Cards marked for trade, ready to browse.
              </h2>
              <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-slate-300">
                This becomes the public cross-user trade page once cards move from localStorage to Postgres.
              </p>
            </div>
            <button
              onClick={onOpenCollection}
              className="h-10 rounded-lg px-4 text-sm font-black text-white"
              style={{ backgroundColor: accent }}
            >
              Mark cards
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#151b24] p-4 shadow-xl">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]">
            <input
              value={tradeQuery}
              onChange={(event) => setTradeQuery(event.target.value)}
              className="h-10 rounded-lg border border-white/10 bg-[#0b1018] px-3 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-white/40"
              placeholder="Search player, team, year, brand..."
            />
            <select
              value={tradeSport}
              onChange={(event) => setTradeSport(event.target.value)}
              className="h-10 rounded-lg border border-white/10 bg-[#0b1018] px-3 text-sm font-black text-white outline-none"
            >
              {sports.map((sport) => (
                <option key={sport}>{sport}</option>
              ))}
            </select>
          </div>
        </div>

        {filteredTradeCards.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredTradeCards.map((card) => (
              <button
                key={card.id}
                onClick={() => onOpenCard(card)}
                className="overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(21,27,36,0.98),rgba(8,12,18,0.98))] p-3 text-left shadow-xl transition hover:-translate-y-0.5 hover:border-white/25"
              >
                <div className="mx-auto h-64">
                  <CardPreview
                    accent={accent}
                    borderStyle={card.borderStyle ?? "Soft"}
                    card={card}
                    frameStyle={card.frameStyle ?? "Card"}
                    imageFit="contain"
                  />
                </div>
                <p className="mt-3 truncate text-lg font-black text-white">{card.player}</p>
                <p className="mt-1 truncate text-sm font-bold text-sky-200">{card.team}</p>
                <p className="mt-3 text-sm font-bold leading-6 text-slate-300">
                  {card.year} {card.brand} {card.set}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-[#111722]">
                    For Trade
                  </span>
                  {card.tags?.slice(0, 3).map((tag) => (
                    <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black text-slate-300">
                      {tag}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-white/10 bg-[#151b24] p-8 text-center shadow-xl">
            <h3 className="text-2xl font-black text-white">No trade cards yet.</h3>
            <p className="mx-auto mt-3 max-w-xl text-sm font-bold leading-6 text-slate-400">
              Set a card status to For Trade in Card Studio and it will appear here.
            </p>
          </div>
        )}
      </div>

      <aside className="grid h-fit gap-4 xl:sticky xl:top-20">
        <DashboardPanel title="Trade signals">
          <MarketplaceSignal label="Available" value={tradeCards.length.toString()} />
          <MarketplaceSignal label="Filtered" value={filteredTradeCards.length.toString()} />
          <MarketplaceSignal label="Sports" value={(sports.length - 1).toString()} />
        </DashboardPanel>
        <ProfilePanel title="Next backend step">
          <p className="text-sm font-bold leading-6 text-slate-400">
            Replace this local list with `CardStatus.FOR_TRADE` records where `public = true`,
            then connect the TradeInterest model for notifications.
          </p>
        </ProfilePanel>
      </aside>
    </section>
  );
}

function InsightsHome({
  accent,
  allCards,
  autoCount,
  biggestCard,
  chaseCards,
  costBasis,
  favoriteCards,
  gradedCount,
  inventoryValue,
  numberedCount,
  onOpenCard,
  onOpenCollection,
  portfolioGain,
  soldValue,
}: {
  accent: string;
  allCards: Card[];
  autoCount: number;
  biggestCard?: Card;
  chaseCards: Card[];
  costBasis: number;
  favoriteCards: Card[];
  gradedCount: number;
  inventoryValue: number;
  numberedCount: number;
  onOpenCard: (card: Card) => void;
  onOpenCollection: () => void;
  portfolioGain: number;
  soldValue: number;
}) {
  const displayCards = favoriteCards.length ? favoriteCards : allCards.slice(0, 5);
  const growthBars = [28, 42, 34, 58, 52, 76, 70, 88, 80, 100];

  return (
    <section className="mx-auto grid max-w-[1440px] gap-4 px-4 py-4 sm:px-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid gap-4">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.10),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.015))] p-5 shadow-2xl">
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-white/50">
                Insights dashboard
              </p>
              <h2 className="mt-3 max-w-3xl text-4xl font-black leading-tight sm:text-5xl">
                Your collection, market, and showcase in one roster.
              </h2>
              <div className="mt-6 grid gap-3 sm:grid-cols-4">
                <DashboardMetric label="Cards" value={allCards.length.toString()} />
                <DashboardMetric label="Graded" value={gradedCount.toString()} />
                <DashboardMetric label="Autos" value={autoCount.toString()} />
                <DashboardMetric label="Numbered" value={numberedCount.toString()} />
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                Collection value
              </p>
              <p className="mt-3 text-4xl font-black text-white">
                {formatMoney(inventoryValue)}
              </p>
              <p className={`mt-2 text-sm font-black ${portfolioGain >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                {portfolioGain >= 0 ? "+" : ""}
                {formatMoney(portfolioGain)} all-time
              </p>
              <button
                onClick={onOpenCollection}
                className="mt-5 h-10 w-full rounded-md text-sm font-black text-white"
                style={{ backgroundColor: accent }}
              >
                Open collection
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-white/10 bg-[#151b24] p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                Collection growth
              </p>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black text-slate-300">
                10 periods
              </span>
            </div>
            <div className="mt-6 flex h-44 items-end gap-2">
              {growthBars.map((height, index) => (
                <div key={index} className="flex flex-1 items-end rounded-t-lg bg-white/5">
                  <div
                    className="w-full rounded-t-lg"
                    style={{
                      height: `${height}%`,
                      background: `linear-gradient(180deg, ${accent}, rgba(255,255,255,0.12))`,
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#151b24] p-4 shadow-xl">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
              Most valuable card
            </p>
            {biggestCard ? (
              <button onClick={() => onOpenCard(biggestCard)} className="mt-4 w-full text-left">
                <div className="mx-auto h-56 max-w-40">
                  <CardPreview
                    accent={accent}
                    borderStyle={biggestCard.borderStyle ?? "Soft"}
                    card={biggestCard}
                    frameStyle={biggestCard.frameStyle ?? "Card"}
                    large
                  />
                </div>
                <p className="mt-4 text-lg font-black text-white">{biggestCard.player}</p>
                <p className="text-sm font-bold text-slate-400">
                  {biggestCard.year} {biggestCard.brand}
                </p>
              </button>
            ) : (
              <p className="mt-4 text-sm font-bold text-slate-400">
                Upload cards to identify your top card.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#151b24] p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
              Showcase shelf
            </p>
            <span className="text-xs font-black text-slate-400">
              {displayCards.length} featured
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {displayCards.map((card) => (
              <button
                key={card.id}
                onClick={() => onOpenCard(card)}
                className="rounded-xl border border-white/10 bg-black/20 p-3 text-left transition hover:-translate-y-0.5 hover:border-white/25"
              >
                <div className="mx-auto h-40">
                  <CardPreview
                    accent={accent}
                    borderStyle={card.borderStyle ?? "Soft"}
                    card={card}
                    frameStyle={card.frameStyle ?? "Card"}
                  />
                </div>
                <p className="mt-3 truncate text-sm font-black text-white">{card.player}</p>
                <p className="truncate text-xs font-bold text-slate-500">{card.collection}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <aside className="grid h-fit gap-4">
        <DashboardPanel title="Portfolio">
          <MiniStat label="Total spent" value={formatMoney(costBasis)} />
          <MiniStat label="Sold total" value={formatMoney(soldValue)} />
          <MiniStat label="Wishlist" value={chaseCards.length.toString()} />
        </DashboardPanel>
        <DashboardPanel title="Recent activity">
          {(allCards.slice(0, 5)).map((card) => (
            <button key={card.id} onClick={() => onOpenCard(card)} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-2 text-left hover:bg-white/[0.06]">
              <div className="relative h-12 w-9 overflow-hidden rounded border border-white/10 bg-black/25">
                <EditedCardImage card={card} sizes="44px" accent={accent} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white">{card.player}</p>
                <p className="truncate text-xs text-slate-500">{card.status}</p>
              </div>
            </button>
          ))}
        </DashboardPanel>
        <DashboardPanel title="Market movers">
          {["Listing import", "Price alerts", "eBay ask comps", "Prospect watchlist"].map((item) => (
            <div key={item} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-bold text-slate-300">
              {item}
            </div>
          ))}
        </DashboardPanel>
      </aside>
    </section>
  );
}

function PlatformPreview({
  accent,
  allCards,
  collectionName,
  collections,
  favoriteCards,
  onBack,
  onProfileChange,
  profile,
  section,
}: {
  accent: string;
  allCards: Card[];
  collectionName: string;
  collections: string[];
  favoriteCards: Card[];
  onBack: () => void;
  onProfileChange: (profile: CollectorProfile) => void;
  profile: CollectorProfile;
  section: AppSection;
}) {
  const profileCards = favoriteCards.length ? favoriteCards.slice(0, 4) : allCards.slice(0, 4);
  const isProfile = section === "Profile";
  const teams = Array.from(new Set(allCards.map((card) => card.team).filter(Boolean))).slice(0, 5);
  const visibleCollections = collections.length
    ? collections
    : Array.from(new Set(allCards.map((card) => card.collection).filter(Boolean))).slice(0, 4);
  const publicVaults = profile.publicCollections.length
    ? profile.publicCollections
    : visibleCollections.slice(0, 1);
  const favoritePCs = profile.favoritePCs.length ? profile.favoritePCs : teams;
  const publicUrl = `cardroster.app/${profile.handle || "cardroster"}`;

  function updateProfile(updates: Partial<CollectorProfile>) {
    onProfileChange({ ...profile, ...updates });
  }

  function updateFavoritePCs(value: string) {
    updateProfile({
      favoritePCs: value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 8),
    });
  }

  function togglePublicCollection(collection: string) {
    updateProfile({
      publicCollections: profile.publicCollections.includes(collection)
        ? profile.publicCollections.filter((item) => item !== collection)
        : [...profile.publicCollections, collection],
    });
  }

  return (
    <section className="mx-auto grid max-w-[1440px] gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid gap-4">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.075),rgba(255,255,255,0.014))] shadow-2xl">
          <div
            className="h-28 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.01))]"
            style={{
              backgroundImage: `radial-gradient(circle at 18% 30%, ${accent}44, transparent 26%), radial-gradient(circle at 78% 18%, rgba(56,213,255,0.22), transparent 28%), linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.01))`,
            }}
          />
          <div className="p-6">
            <div className="-mt-16 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-end gap-4">
                <div
                  className="grid h-24 w-24 place-items-center rounded-3xl border-4 border-[#111722] text-2xl font-black text-white shadow-2xl"
                  style={{ backgroundColor: accent }}
                >
                  {profile.avatarInitials || "CR"}
                </div>
                <div className="pb-1">
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
                    {isProfile ? "Collector profile" : "Chase board"}
                  </p>
                  <h2 className="mt-1 text-4xl font-black leading-tight sm:text-5xl">
                    {isProfile ? collectionName : "Cards to chase"}
                  </h2>
                  <p className="mt-1 text-sm font-bold text-sky-200">@{profile.handle}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={onBack}
                  className="h-10 rounded-lg px-4 text-sm font-black text-white"
                  style={{ backgroundColor: accent }}
                >
                  Home
                </button>
                <button
                  onClick={() => navigator.clipboard?.writeText(`https://${publicUrl}`)}
                  className="h-10 rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-black text-slate-200 hover:bg-white/10"
                >
                  {isProfile ? "Copy profile link" : "Add chase card"}
                </button>
              </div>
            </div>
            <div className="mt-5 grid max-w-2xl gap-2 sm:grid-cols-3">
              <MiniStat label="Cards" value={allCards.length.toString()} />
              <MiniStat label="Public vaults" value={publicVaults.length.toString()} />
              <MiniStat label={isProfile ? "Followers" : "Chases"} value={isProfile ? "0" : profileCards.length.toString()} />
            </div>
            {isProfile ? (
              <p className="mt-4 max-w-3xl text-sm font-bold leading-6 text-slate-300">
                {profile.bio}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-2">
              {(favoritePCs.length ? favoritePCs : ["Blue Jays PC", "Rookie cards", "Trade bait"]).map((team) => (
                <span key={team} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-black text-slate-200">
                  {team}
                </span>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Theme: Arena", "Banner: Team glow", "Shelf: Featured first"].map((item) => (
                <span key={item} className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-black text-slate-300">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#151b24] p-4 shadow-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                {isProfile ? "Featured shelf" : "Wishlist shelf"}
              </p>
              <h3 className="mt-1 text-2xl font-black">
                {isProfile ? "Showcase cards" : "Cards to chase"}
              </h3>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black text-slate-300">
              {profileCards.length} shown
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {profileCards.map((card) => (
              <div key={card.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="mx-auto h-48">
                  <CardPreview
                    accent={accent}
                    borderStyle={card.borderStyle ?? "Soft"}
                    card={card}
                    frameStyle={card.frameStyle ?? "Card"}
                    imageFit="contain"
                  />
                </div>
                <p className="mt-3 truncate text-sm font-black text-white">{card.player}</p>
                <p className="truncate text-xs font-bold text-slate-500">{card.collection}</p>
              </div>
            ))}
            {profileCards.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 p-6 text-sm font-bold text-slate-400">
                Add cards to make this section useful.
              </div>
            ) : null}
          </div>
        </div>

        {isProfile ? (
          <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
            <ProfilePanel title="Public vaults">
              <div className="grid gap-2">
                {(visibleCollections.length ? visibleCollections : ["Main Collection"]).map((item) => (
                  <div key={item} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div>
                      <p className="text-sm font-black text-white">{item}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {allCards.filter((card) => card.collection === item).length || allCards.length} cards
                      </p>
                    </div>
                    <button
                      onClick={() => togglePublicCollection(item)}
                      className={`rounded-full px-3 py-1 text-[11px] font-black ${
                        publicVaults.includes(item)
                          ? "text-white"
                          : "border border-white/10 bg-white/5 text-slate-300"
                      }`}
                      style={publicVaults.includes(item) ? { backgroundColor: accent } : undefined}
                    >
                      {publicVaults.includes(item) ? "Public" : "Private"}
                    </button>
                  </div>
                ))}
              </div>
            </ProfilePanel>
            <ProfilePanel title="Profile settings">
              <div className="grid gap-3">
                <EditField label="Handle">
                  <input
                    value={profile.handle}
                    onChange={(event) => updateProfile({ handle: slugHandle(event.target.value) })}
                    className="studio-field"
                    placeholder="cardroster"
                  />
                </EditField>
                <EditField label="Avatar">
                  <input
                    value={profile.avatarInitials}
                    onChange={(event) => updateProfile({ avatarInitials: event.target.value.toUpperCase().slice(0, 3) })}
                    className="studio-field"
                    placeholder="CR"
                  />
                </EditField>
                <EditField label="Bio">
                  <textarea
                    value={profile.bio}
                    onChange={(event) => updateProfile({ bio: event.target.value.slice(0, 180) })}
                    className="studio-field min-h-24 py-2"
                    placeholder="What do you collect?"
                  />
                </EditField>
                <EditField label="Favorite PCs">
                  <input
                    value={profile.favoritePCs.join(", ")}
                    onChange={(event) => updateFavoritePCs(event.target.value)}
                    className="studio-field"
                    placeholder="Blue Jays, rookies, autos"
                  />
                </EditField>
              </div>
            </ProfilePanel>
          </div>
        ) : null}
      </div>

      <aside className="grid h-fit gap-4">
        <CollectorProfileCard
          accent={accent}
          cardCount={allCards.length}
          collectionName={collectionName}
          profile={profile}
          vaultCount={publicVaults.length}
        />
        <CollectorSearchPanel accent={accent} />
        <div className="rounded-2xl border border-white/10 bg-[#151b24] p-4 shadow-xl">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
            Links and proof
          </p>
          <div className="mt-3 grid gap-2">
            {["Marketplace link", "Social contact", "Ownership proof"].map((item) => (
              <div key={item} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-bold text-slate-300">
                {item}
              </div>
            ))}
          </div>
        </div>
      </aside>
    </section>
  );
}

function PublicFeed({
  accent,
  cards,
  collectionName,
  profile,
  onOpenCard,
  onOpenCollection,
}: {
  accent: string;
  cards: Card[];
  collectionName: string;
  profile: CollectorProfile;
  onOpenCard: (card: Card) => void;
  onOpenCollection: () => void;
}) {
  const [likedCards, setLikedCards] = useState<string[]>([]);
  const [savedCards, setSavedCards] = useState<string[]>([]);
  const [wishlistCards, setWishlistCards] = useState<string[]>([]);
  const [activeCommentId, setActiveCommentId] = useState("");
  const [feedView, setFeedView] = useState<"Activity" | "Cards" | "Vaults" | "Members">("Activity");
  const feedCards = cards.length ? cards : [];
  const tradeCards = cards.filter((card) => card.status === "For Trade");
  const teams = Array.from(new Set(cards.map((card) => card.team).filter(Boolean))).slice(0, 6);
  const collections = Array.from(new Set(cards.map((card) => card.collection).filter(Boolean))).slice(0, 4);

  function toggle(list: string[], setList: (items: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  }

  return (
    <section className="mx-auto grid max-w-[1440px] gap-4 px-4 py-4 sm:px-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="grid gap-4">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_15%_0%,rgba(255,255,255,0.12),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.075),rgba(255,255,255,0.014))] p-5 shadow-2xl">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
                Public collector feed
              </p>
              <h2 className="mt-2 max-w-3xl text-4xl font-black leading-tight sm:text-5xl">
                Scroll grails, pickups, trades, and PCs.
              </h2>
              <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-slate-300">
                Follow collectors, react to pickups, save chase ideas, and jump to trusted external sale links.
              </p>
            </div>
            <div className="flex rounded-full border border-white/10 bg-black/25 p-1">
              {(["Activity", "Cards", "Vaults", "Members"] as const).map((item) => (
                <button
                  key={item}
                  onClick={() => setFeedView(item)}
                  className={`h-9 rounded-full px-4 text-xs font-black transition ${
                    feedView === item
                      ? "text-white"
                      : "text-slate-300 hover:bg-white/10"
                  }`}
                  style={feedView === item ? { background: `linear-gradient(135deg, ${accent}, #ff7a45)` } : undefined}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>

        {feedCards.length ? (
          <>
            <div className="rounded-2xl border border-white/10 bg-[#151b24] p-4 shadow-xl">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                    Recent collector activity
                  </p>
                  <h3 className="mt-1 text-2xl font-black text-white">
                    Pickups, likes, wishlists, and vault updates
                  </h3>
                </div>
                <div className="relative">
                  <input
                    className="h-9 w-full rounded-full border border-white/10 bg-[#0b1018] px-4 text-xs font-bold text-white outline-none placeholder:text-slate-500 focus:border-white/40 sm:w-64"
                    placeholder="Search cards, users, teams..."
                  />
                </div>
              </div>
              <div className="mt-4 grid gap-2">
                {feedCards.slice(0, 5).map((card, index) => (
                  <button
                    key={`${card.id}-activity`}
                    onClick={() => onOpenCard(card)}
                    className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-2 text-left transition hover:bg-white/[0.06]"
                  >
                    <CleanCardThumb accent={accent} card={card} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-white">
                        {index % 3 === 0 ? "Added a new pickup" : index % 3 === 1 ? "Featured a grail" : "Updated a vault"}
                      </p>
                      <p className="truncate text-xs font-bold text-slate-500">
                        {card.player} / {card.year} {card.brand} / {card.collection}
                      </p>
                    </div>
                    <div className="hidden gap-3 text-xs font-black text-slate-500 sm:flex">
                      <span>{12 + index * 7} likes</span>
                      <span>{2 + index} comments</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
              <ProfilePanel title="Featured vault lists">
                <div className="grid gap-3">
                  {(collections.length ? collections : ["Main Collection"]).slice(0, 3).map((item) => {
                    const vaultCards = feedCards.filter((card) => card.collection === item).slice(0, 4);
                    const previewCards = vaultCards.length ? vaultCards : feedCards.slice(0, 4);

                    return (
                      <div key={item} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 transition hover:-translate-y-0.5 hover:border-white/25">
                        <div className="flex gap-2 overflow-hidden">
                          {previewCards.map((card) => (
                            <div key={`${item}-${card.id}`} className="w-16 shrink-0">
                              <CleanCardThumb accent={accent} card={card} />
                            </div>
                          ))}
                        </div>
                        <p className="mt-3 text-sm font-black text-white">{item}</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">
                          {previewCards.length} cards / public vault
                        </p>
                      </div>
                    );
                  })}
                </div>
              </ProfilePanel>
              <ProfilePanel title="Members to watch">
                <div className="grid gap-3">
                  {(teams.length ? teams : ["Blue Jays", "Rookies", "Prospects"]).slice(0, 4).map((team, index) => (
                    <div key={team} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className="grid h-11 w-11 place-items-center rounded-full text-xs font-black text-white"
                          style={{ backgroundColor: index % 2 ? "#38bdf8" : accent }}
                        >
                          CR
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-white">{team} collector</p>
                          <p className="truncate text-xs font-bold text-slate-500">
                            {24 + index * 13} cards / {6 + index * 4} followers
                          </p>
                        </div>
                      </div>
                      <button className="h-8 rounded-full border border-white/10 bg-white/5 px-3 text-[11px] font-black text-slate-300 hover:bg-white/10">
                        Follow
                      </button>
                    </div>
                  ))}
                </div>
              </ProfilePanel>
            </div>
          </>
        ) : null}

        {feedCards.length ? (
          <div className="grid gap-4">
            {feedCards.map((card, index) => {
              const liked = likedCards.includes(card.id);
              const saved = savedCards.includes(card.id);
              const wishlisted = wishlistCards.includes(card.id);

              return (
                <article
                  key={card.id}
                  className="overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(21,27,36,0.98),rgba(8,12,18,0.98))] shadow-2xl"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
                    <button className="flex min-w-0 items-center gap-3 text-left">
                      <div
                        className="grid h-11 w-11 place-items-center rounded-xl text-sm font-black text-white"
                        style={{ backgroundColor: card.color || accent }}
                      >
                        {profile.avatarInitials || "CR"}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-white">
                          {index % 2 === 0 ? collectionName : `${card.team || "Collector"} PC`}
                        </p>
                        <p className="truncate text-xs font-bold text-slate-500">
                          @{index % 2 === 0 ? profile.handle : card.collection.toLowerCase().replaceAll(" ", "")} / {card.status}
                        </p>
                      </div>
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="hidden rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-black text-slate-300 sm:inline-flex">
                        {8 + index * 3} watching
                      </span>
                      <button className="h-8 rounded-full border border-white/10 bg-white/5 px-3 text-xs font-black text-slate-200 hover:bg-white/10">
                        Follow
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => onOpenCard(card)}
                    className="grid w-full gap-4 p-4 text-left lg:grid-cols-[minmax(280px,420px)_minmax(0,1fr)] lg:items-center"
                  >
                    <div className="mx-auto h-[min(68vh,560px)] w-full max-w-[390px] rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.10),transparent_42%),rgba(0,0,0,0.22)] p-4">
                      <CardPreview
                        accent={accent}
                        borderStyle={card.borderStyle ?? "Soft"}
                        card={card}
                        frameStyle={card.frameStyle ?? "Card"}
                        imageFit="contain"
                        large
                        tight
                      />
                    </div>
                    <div className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-5">
                      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                        Featured pickup
                      </p>
                      <h3 className="mt-2 text-3xl font-black leading-tight text-white">
                        {card.player}
                      </h3>
                      <p className="mt-2 text-sm font-bold text-sky-200">{card.team}</p>
                      <p className="mt-5 text-base font-black leading-7 text-slate-100">
                        {card.year} {card.brand} {card.set}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {[card.collection, card.status, ...(card.tags ?? [])].slice(0, 5).map((item) => (
                          <span key={item} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black text-slate-300">
                            {item}
                          </span>
                        ))}
                      </div>
                      <div className="mt-5 grid grid-cols-3 gap-2">
                        <MiniStat label="Likes" value={(18 + index * 9).toString()} />
                        <MiniStat label="Comments" value={(3 + index).toString()} />
                        <MiniStat label="Saves" value={(7 + index * 2).toString()} />
                      </div>
                    </div>
                  </button>

                  <div className="border-t border-white/10 bg-black/10 p-4">
                    <div className="grid gap-2 sm:grid-cols-5">
                      <FeedAction
                        active={liked}
                        label={liked ? "Admired" : "Admire"}
                        count={18 + index * 9 + (liked ? 1 : 0)}
                        onClick={() => toggle(likedCards, setLikedCards, card.id)}
                      />
                      <FeedAction
                        active={saved}
                        label={saved ? "Pinned" : "Pin"}
                        count={7 + index * 2 + (saved ? 1 : 0)}
                        onClick={() => toggle(savedCards, setSavedCards, card.id)}
                      />
                      <FeedAction
                        active={wishlisted}
                        label={wishlisted ? "Wishlisted" : "Wishlist"}
                        count={wishlisted ? 1 : 0}
                        onClick={() => toggle(wishlistCards, setWishlistCards, card.id)}
                      />
                      <FeedAction
                        active={activeCommentId === card.id}
                        label="Discuss"
                        count={3 + index}
                        onClick={() => setActiveCommentId(activeCommentId === card.id ? "" : card.id)}
                      />
                      {card.sourceUrl ? (
                        <a
                          href={card.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-slate-200 hover:bg-white/10"
                        >
                          Listing
                        </a>
                      ) : (
                        <FeedAction label="Trade" onClick={() => setActiveCommentId(card.id)} />
                      )}
                    </div>
                    {activeCommentId === card.id ? (
                      <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3">
                        <textarea
                          className="min-h-20 w-full resize-none rounded-xl border border-white/10 bg-[#0b1018] p-3 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-white/40"
                          placeholder="Ask about the card, compliment the pickup, or coordinate off-platform..."
                        />
                        <div className="mt-2 flex flex-wrap justify-between gap-2">
                          <p className="text-xs font-bold leading-5 text-slate-500">
                            CardRoster can coordinate interest, but payment and deals stay off-site.
                          </p>
                          <button
                            className="h-9 rounded-lg px-4 text-xs font-black text-white"
                            style={{ backgroundColor: accent }}
                          >
                            Post comment
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-[#151b24] p-8 text-center shadow-2xl">
            <h3 className="text-2xl font-black text-white">Your feed needs cards.</h3>
            <p className="mx-auto mt-3 max-w-xl text-sm font-bold leading-6 text-slate-400">
              Upload a few cards first, then this becomes the prototype for public collector posts.
            </p>
            <button
              onClick={onOpenCollection}
              className="mt-5 h-10 rounded-lg px-4 text-sm font-black text-white"
              style={{ backgroundColor: accent }}
            >
              Open collection
            </button>
          </div>
        )}
      </div>

      <aside className="grid h-fit gap-4 xl:sticky xl:top-20">
        <CollectorSearchPanel accent={accent} />
        <ProfilePanel title="Trending PCs">
          <div className="flex flex-wrap gap-2">
            {(teams.length ? teams : ["Blue Jays", "Rookies", "Autos", "Prospects"]).map((team) => (
              <span key={team} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-black text-slate-200">
                {team}
              </span>
            ))}
          </div>
        </ProfilePanel>
        <ProfilePanel title="Active marketplace signals">
          <div className="grid gap-2">
            <MarketplaceSignal label="Trade posts" value={tradeCards.length.toString()} />
            <MarketplaceSignal label="External listings" value={cards.filter((card) => card.sourceUrl).length.toString()} />
            <MarketplaceSignal label="Wishlisted" value={wishlistCards.length.toString()} />
          </div>
        </ProfilePanel>
        <ProfilePanel title="Safety">
          <div className="grid gap-2">
            {["Private uploads by default", "Report public posts", "External deals only"].map((item) => (
              <div key={item} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-bold text-slate-300">
                {item}
              </div>
            ))}
          </div>
        </ProfilePanel>
      </aside>
    </section>
  );
}

function FeedAction({
  active = false,
  count,
  label,
  onClick,
}: {
  active?: boolean;
  count?: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-10 items-center justify-center rounded-full border px-3 text-xs font-black transition ${
        active
          ? "border-white/30 bg-white text-[#111722] shadow-[0_0_24px_rgba(255,255,255,0.12)]"
          : "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.025))] text-slate-200 hover:border-white/25 hover:bg-white/10"
      }`}
    >
      <span>{label}</span>
      {typeof count === "number" ? (
        <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] ${active ? "bg-[#111722]/10 text-[#111722]" : "bg-black/25 text-slate-300"}`}>
          {count}
        </span>
      ) : null}
    </button>
  );
}

function MarketplaceSignal({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <span className="text-sm font-bold text-slate-400">{label}</span>
      <span className="text-sm font-black text-white">{value}</span>
    </div>
  );
}

function CollectorWorkbench({
  accent,
  cards,
  collectionName,
  onExport,
  onOpenCard,
  onOpenCollection,
}: {
  accent: string;
  cards: Card[];
  collectionName: string;
  onExport: () => void;
  onOpenCard: (card: Card) => void;
  onOpenCollection: () => void;
}) {
  const gradingCards = cards.filter((card) =>
    card.status === "Wishlist" ||
    card.grade === "Raw" ||
    card.gradingFee ||
    card.certNumber,
  );
  const tradeCards = cards.filter((card) => card.status === "For Trade");
  const missingStorage = cards.filter((card) => !card.storageLocation).length;
  const missingNumbers = cards.filter((card) => !card.cardNumber).length;
  const withLinks = cards.filter((card) => card.sourceUrl).length;

  return (
    <section className="mx-auto grid max-w-[1440px] gap-4 px-4 py-4 sm:px-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid gap-4">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_15%_0%,rgba(255,255,255,0.12),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.075),rgba(255,255,255,0.014))] p-6 shadow-2xl">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
            Collector workbench
          </p>
          <h2 className="mt-2 max-w-3xl text-4xl font-black leading-tight sm:text-5xl">
            Collection tools that keep the roster clean.
          </h2>
          <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-slate-300">
            Export, research, grading review, storage checks, and trade-ready cards in one workbench.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              onClick={onExport}
              disabled={cards.length === 0}
              className="h-10 rounded-lg px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: accent }}
            >
              Export CSV
            </button>
            <button
              onClick={onOpenCollection}
              className="h-10 rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-black text-slate-200 hover:bg-white/10"
            >
              Open collection
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WorkbenchMetric label="Cards" value={cards.length.toString()} />
          <WorkbenchMetric label="Trade ready" value={tradeCards.length.toString()} />
          <WorkbenchMetric label="Missing location" value={missingStorage.toString()} />
          <WorkbenchMetric label="Missing card #" value={missingNumbers.toString()} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_0.95fr]">
          <ProfilePanel title="Out for grading / review">
            <div className="grid gap-2">
              {gradingCards.slice(0, 6).map((card) => (
                <button
                  key={card.id}
                  onClick={() => onOpenCard(card)}
                  className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-2 text-left hover:bg-white/[0.06]"
                >
                  <CleanCardThumb accent={accent} card={card} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-white">{card.player}</p>
                    <p className="truncate text-xs font-bold text-slate-500">
                      {card.year} {card.brand} {card.set}
                    </p>
                  </div>
                  <GradingDecision card={card} />
                </button>
              ))}
              {gradingCards.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm font-bold text-slate-400">
                  Mark raw cards or add grading fees to build this queue.
                </p>
              ) : null}
            </div>
          </ProfilePanel>

          <ProfilePanel title="Lookup links">
            <div className="grid gap-2">
              {(cards.slice(0, 5)).map((card) => (
                <div key={card.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="truncate text-sm font-black text-white">{card.player}</p>
                  <p className="mt-1 truncate text-xs font-bold text-slate-500">
                    {card.year} {card.brand} {card.set}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <LookupLink href={ebaySearchUrl(card)} label="eBay listings" />
                    <LookupLink href={certLookupUrl(card)} label="Cert lookup" />
                  </div>
                </div>
              ))}
            </div>
          </ProfilePanel>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <ProfilePanel title="Trade and wishlist matching">
            <div className="grid gap-2">
              {tradeCards.slice(0, 4).map((card) => (
                <button
                  key={card.id}
                  onClick={() => onOpenCard(card)}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left hover:bg-white/[0.06]"
                >
                  <p className="truncate text-sm font-black text-white">{card.player}</p>
                  <p className="mt-1 truncate text-xs font-bold text-slate-500">{card.collection}</p>
                </button>
              ))}
              {tradeCards.length === 0 ? (
                <p className="text-sm font-bold leading-6 text-slate-400">
                  Mark cards as For Trade to make them appear in matching and public coordination.
                </p>
              ) : null}
            </div>
          </ProfilePanel>

          <ProfilePanel title="Roster cleanup">
            <div className="grid gap-2">
              <MarketplaceSignal label="Source links" value={`${withLinks}/${cards.length}`} />
              <MarketplaceSignal label="Storage locations" value={`${cards.length - missingStorage}/${cards.length}`} />
              <MarketplaceSignal label="Card numbers" value={`${cards.length - missingNumbers}/${cards.length}`} />
            </div>
          </ProfilePanel>
        </div>
      </div>

      <aside className="grid h-fit gap-4 xl:sticky xl:top-20">
        <CollectorProfileCard accent={accent} cardCount={cards.length} collectionName={collectionName} />
        <ProfilePanel title="Quick actions">
          <div className="grid gap-2">
            <button onClick={onExport} disabled={cards.length === 0} className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-slate-200 hover:bg-white/10 disabled:opacity-40">
              Export collection
            </button>
            <button onClick={onOpenCollection} className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black text-slate-200 hover:bg-white/10">
              Review gallery
            </button>
          </div>
        </ProfilePanel>
        <ProfilePanel title="Next tools">
          <div className="grid gap-2">
            {["Spreadsheet import", "eBay links", "Cert lookup"].map((item) => (
              <div key={item} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-bold text-slate-300">
                {item}
              </div>
            ))}
          </div>
        </ProfilePanel>
      </aside>
    </section>
  );
}

function WorkbenchMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#151b24] p-4 shadow-xl">
      <p className="text-3xl font-black text-white">{value}</p>
      <p className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
    </div>
  );
}

function GradingDecision({ card }: { card: Card }) {
  const cost = moneyValue(card.purchasePrice) + moneyValue(card.gradingFee);
  const value = cardValue(card);
  const decision = !cost || !value ? "Review" : value > cost * 1.5 ? "Good" : value > cost ? "Close" : "Skip";
  const color =
    decision === "Good"
      ? "text-emerald-300"
      : decision === "Close"
        ? "text-yellow-300"
        : decision === "Skip"
          ? "text-red-300"
          : "text-slate-300";

  return <span className={`text-xs font-black ${color}`}>{decision}</span>;
}

function LookupLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-8 items-center justify-center rounded-md border border-white/10 bg-white/5 px-2 text-[11px] font-black text-slate-200 hover:bg-white/10"
    >
      {label}
    </a>
  );
}

function CardResearchPanel({ card }: { card: Card }) {
  const [marketMessage, setMarketMessage] = useState("");
  const [marketValue, setMarketValue] = useState<number | null>(null);
  const [marketListings, setMarketListings] = useState<
    Array<{ itemWebUrl: string; price: number | null; title: string }>
  >([]);
  const [marketLoading, setMarketLoading] = useState(false);

  async function scanEbayMarket() {
    if (marketLoading) return;

    setMarketLoading(true);
    setMarketMessage("");
    setMarketValue(null);
    setMarketListings([]);

    try {
      const response = await fetch(`/api/ebay/search?q=${encodeURIComponent(cardSearchText(card))}`);
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error ?? "Unable to scan eBay market.");
      }

      setMarketValue(typeof body.suggestedValue === "number" ? body.suggestedValue : null);
      setMarketListings(Array.isArray(body.listings) ? body.listings.slice(0, 3) : []);
      setMarketMessage(
        body.suggestedValue
          ? "Market scan found active listing comps."
          : "Market scan ran, but no priced listings came back.",
      );
    } catch (error) {
      setMarketMessage(error instanceof Error ? error.message : "Unable to scan eBay market.");
    } finally {
      setMarketLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
        Lookup links
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <LookupLink href={ebaySearchUrl(card)} label="eBay listings" />
        <LookupLink href={certLookupUrl(card)} label="Cert lookup" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Detail label="All-in" value={formatMoney(moneyValue(card.purchasePrice) + moneyValue(card.gradingFee))} />
        <Detail label="Grade call" value={gradingDecisionText(card)} />
      </div>
      <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
              eBay market scan
            </p>
            <p className="mt-1 text-xs font-bold leading-5 text-slate-400">
              Current asking prices from active eBay listings.
            </p>
          </div>
          <button
            onClick={scanEbayMarket}
            disabled={marketLoading}
            className="h-8 shrink-0 rounded-md border border-white/10 bg-white/5 px-3 text-[11px] font-black text-slate-200 hover:bg-white/10 disabled:opacity-50"
          >
            {marketLoading ? "Scanning" : "Scan"}
          </button>
        </div>
        {marketMessage ? (
          <p className="mt-2 text-xs font-bold text-slate-300">{marketMessage}</p>
        ) : null}
        {marketValue !== null ? (
          <div className="mt-3">
            <Detail label="Suggested" value={formatMoney(marketValue)} />
          </div>
        ) : null}
        {marketListings.length ? (
          <div className="mt-3 grid gap-2">
            {marketListings.map((listing) => (
              <a
                key={`${listing.itemWebUrl}-${listing.title}`}
                href={listing.itemWebUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/5"
              >
                <span className="block truncate text-white">{listing.title}</span>
                <span>{listing.price ? formatMoney(listing.price) : "No price"}</span>
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CardDetailModal({
  accent,
  borderStyle,
  card,
  frameStyle,
  onClose,
  onNext,
  onPrevious,
}: {
  accent: string;
  borderStyle: BorderStyle;
  card?: Card;
  frameStyle: FrameStyle;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
}) {
  if (!card) return null;
  const value = cardValue(card);
  const gain = value - moneyValue(card.purchasePrice);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#05070b]/96 p-4 backdrop-blur-2xl">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_25%_18%,rgba(255,255,255,0.08),transparent_24%),linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:auto,52px_52px,52px_52px]" />
      <div className="relative mx-auto grid min-h-full max-w-7xl gap-5 py-6 lg:grid-cols-[minmax(320px,470px)_minmax(0,1fr)] lg:items-center">
        <div className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.12),transparent_42%),rgba(255,255,255,0.035)] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.55)] sm:p-5">
          <div className="mx-auto h-[min(72vh,680px)] max-h-[680px] max-w-[420px]">
            <CardPreview
              card={card}
              accent={accent}
              borderStyle={card.borderStyle ?? borderStyle}
              frameStyle={card.frameStyle ?? frameStyle}
              large
              imageFit="contain"
              tight
            />
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(17,23,34,0.96),rgba(7,10,15,0.96))] p-5 shadow-2xl sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                {card.collection}
              </p>
              <h2 className="mt-2 text-4xl font-black leading-[1.05] text-white sm:text-5xl">
                {card.player}
              </h2>
              <p className="mt-2 text-base font-bold text-sky-200">{card.team}</p>
            </div>
            <button
              onClick={onClose}
              className="h-9 rounded-md border border-white/10 bg-white/5 px-3 text-xs font-black text-slate-200 hover:bg-white/10"
            >
              Close
            </button>
          </div>
          <p className="mt-5 max-w-3xl text-xl font-black leading-8 text-white">
            {[card.year, card.brand, card.set, card.cardNumber ? `#${card.cardNumber}` : "", card.parallel]
              .filter(Boolean)
              .join(" ")}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/20 bg-white px-3 py-1 text-xs font-black text-[#111722]">
              {card.status}
            </span>
            {isDisplayGrade(card.grade) ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-slate-200">
                {card.grade}
              </span>
            ) : null}
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-slate-200">
              {card.collection}
            </span>
          </div>
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              Market value
            </p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
              <p className="text-4xl font-black text-white">{formatMoney(value)}</p>
              <p className={`text-sm font-black ${gain >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                {moneyValue(card.purchasePrice)
                  ? `${gain >= 0 ? "+" : ""}${formatMoney(gain)} vs cost`
                  : "Add cost to track gain"}
              </p>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Detail label="Cost" value={formatMoney(moneyValue(card.purchasePrice))} />
              <Detail label="Sale" value={card.saleStatus ?? "Holding"} />
              <Detail label="Sold" value={formatMoney(moneyValue(card.salePrice))} />
            </div>
          </div>
          {card.notes ? (
            <p className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-sm font-bold leading-6 text-slate-300">
              {card.notes}
            </p>
          ) : null}
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <Detail label="Sport" value={card.sport} />
            <Detail label="Year" value={card.year} />
            <Detail label="Brand" value={card.brand} />
          </div>
          {card.tags?.length ? <TagRow tags={card.tags} /> : null}
          <div className="mt-6 flex flex-wrap gap-2">
            <button onClick={onPrevious} className="h-10 rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-black text-slate-200 hover:bg-white/10">
              Previous
            </button>
            <button onClick={onNext} className="h-10 rounded-lg px-4 text-sm font-black text-white hover:brightness-110" style={{ backgroundColor: accent }}>
              Next
            </button>
            {card.sourceUrl ? (
              <a href={card.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-black text-slate-200 hover:bg-white/10">
                Source
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ShowcaseOverlay({
  accent,
  borderStyle,
  cards,
  frameStyle,
  onClose,
}: {
  accent: string;
  borderStyle: BorderStyle;
  cards: Card[];
  frameStyle: FrameStyle;
  onClose: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeCard = cards[activeIndex];

  if (!activeCard) return null;

  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-[#030508]/95 text-white backdrop-blur-xl">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:48px_48px] opacity-30" />
      <div className="relative grid h-full grid-rows-[auto_1fr_auto] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
              Showcase mode
            </p>
            <h2 className="mt-1 text-2xl font-black">{activeCard.collection}</h2>
          </div>
          <button onClick={onClose} className="h-9 rounded-md border border-white/10 bg-white/5 px-3 text-xs font-black text-slate-200 hover:bg-white/10">
            Exit
          </button>
        </div>
        <div className="grid min-h-0 gap-6 py-4 lg:grid-cols-[minmax(260px,430px)_minmax(0,1fr)] lg:items-center">
          <div className="mx-auto h-[min(70vh,620px)] w-full max-w-[430px] rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.12),transparent_40%),rgba(255,255,255,0.03)] p-5">
            <CardPreview
              card={activeCard}
              accent={accent}
              borderStyle={activeCard.borderStyle ?? borderStyle}
              frameStyle={activeCard.frameStyle ?? frameStyle}
              large
              imageFit="contain"
            />
          </div>
          <div className="max-w-2xl">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
              Now viewing
            </p>
            <h3 className="mt-3 text-5xl font-black leading-tight">{activeCard.player}</h3>
            <p className="mt-3 text-lg font-bold text-sky-200">{activeCard.team}</p>
            <p className="mt-8 text-xl font-black leading-8">
              {activeCard.year} {activeCard.brand} {activeCard.set}
            </p>
            {activeCard.tags?.length ? <TagRow tags={activeCard.tags} /> : null}
            <div className="mt-8 flex gap-2">
              <button onClick={() => setActiveIndex((activeIndex - 1 + cards.length) % cards.length)} className="h-11 rounded-md border border-white/10 bg-white/5 px-5 text-sm font-black text-slate-200 hover:bg-white/10">
                Previous
              </button>
              <button onClick={() => setActiveIndex((activeIndex + 1) % cards.length)} className="h-11 rounded-md bg-white px-5 text-sm font-black text-[#111722] hover:bg-slate-200">
                Next
              </button>
            </div>
          </div>
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {cards.map((card, index) => (
            <button
              key={card.id}
              onClick={() => setActiveIndex(index)}
              className={`relative h-16 w-12 shrink-0 overflow-hidden rounded border bg-black/25 ${
                activeIndex === index ? "border-white" : "border-white/15 opacity-60"
              }`}
            >
              <EditedCardImage card={card} sizes="48px" accent={accent} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function readBorderStyle(value: string | null): BorderStyle {
  if (value === "Chrome" || value === "Glow" || value === "Soft") {
    return value;
  }

  return "Soft";
}

function readFrameStyle(value: string | null): FrameStyle {
  if (
    value === "Card" ||
    value === "Gradient" ||
    value === "Sunset" ||
    value === "Stand"
  ) {
    return value;
  }

  return "Card";
}

function readCollectorProfile(value: string | null): CollectorProfile {
  if (!value) return defaultCollectorProfile;

  try {
    const parsed = JSON.parse(value) as Partial<CollectorProfile>;

    return {
      handle: slugHandle(parsed.handle ?? defaultCollectorProfile.handle),
      bio: (parsed.bio ?? defaultCollectorProfile.bio).slice(0, 180),
      avatarInitials: (parsed.avatarInitials ?? defaultCollectorProfile.avatarInitials)
        .toUpperCase()
        .slice(0, 3),
      favoritePCs: sanitizeTextList(parsed.favoritePCs, defaultCollectorProfile.favoritePCs),
      publicCollections: sanitizeTextList(
        parsed.publicCollections,
        defaultCollectorProfile.publicCollections,
      ),
    };
  } catch {
    return defaultCollectorProfile;
  }
}

function sanitizeTextList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;

  const items = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  return items.length ? Array.from(new Set(items)).slice(0, 8) : fallback;
}

function slugHandle(value: string) {
  const handle = value
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "")
    .slice(0, 24);

  return handle || "cardroster";
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/25 p-3">
      <p className="truncate text-lg font-black text-white">{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
    </div>
  );
}

function DashboardMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
      <p className="truncate text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
    </div>
  );
}

function GalleryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="truncate text-sm font-black text-white">{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
    </div>
  );
}

function SocialStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="text-lg font-black text-white">{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
    </div>
  );
}

function CollectorProfileCard({
  accent,
  cardCount,
  collectionName,
  profile = defaultCollectorProfile,
  vaultCount = 1,
}: {
  accent: string;
  cardCount: number;
  collectionName: string;
  profile?: CollectorProfile;
  vaultCount?: number;
}) {
  const publicUrl = `cardroster.app/${profile.handle || "cardroster"}`;

  return (
    <div className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(21,27,36,0.98),rgba(8,12,18,0.98))] p-4 shadow-xl">
      <div className="flex items-center gap-3">
        <div
          className="grid h-12 w-12 place-items-center rounded-xl text-sm font-black text-white"
          style={{ backgroundColor: accent }}
        >
          {profile.avatarInitials || "CR"}
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-black text-white">{collectionName}</p>
          <p className="text-xs font-bold text-slate-500">@{profile.handle}</p>
        </div>
      </div>
      {profile.bio ? (
        <p className="mt-3 line-clamp-3 text-sm font-bold leading-6 text-slate-400">
          {profile.bio}
        </p>
      ) : null}
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <MiniStat label="Cards" value={cardCount.toString()} />
        <MiniStat label="Followers" value="0" muted />
        <MiniStat label="Vaults" value={vaultCount.toString()} />
      </div>
      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
          Share profile
        </p>
        <p className="mt-1 truncate text-xs font-bold text-sky-200">
          {publicUrl}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => navigator.clipboard?.writeText(`https://${publicUrl}`)}
            className="h-8 rounded-md border border-white/10 bg-white/5 text-[11px] font-black text-slate-200 hover:bg-white/10"
          >
            Copy link
          </button>
          <button className="h-8 rounded-md border border-white/10 bg-white/5 text-[11px] font-black text-slate-200 hover:bg-white/10">
            Find users
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfilePanel({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#151b24] p-4 shadow-xl">
      <p className="mb-3 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
        {title}
      </p>
      {children}
    </div>
  );
}

function CollectorSearchPanel({ accent }: { accent: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#151b24] p-4 shadow-xl">
      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
        Collector network
      </p>
      <h3 className="mt-2 text-2xl font-black text-white">Find people and PCs</h3>
      <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-2">
        <input
          className="h-10 w-full rounded-lg border border-white/10 bg-[#0b1018] px-3 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-white/40"
          placeholder="Search users, teams, players..."
        />
      </div>
      <div className="mt-3 grid gap-2">
        {[
          "Follow collectors with matching PCs",
          "Share public vault links",
          "Message about trades or sales",
          "Browse team and player communities",
        ].map((item) => (
          <div
            key={item}
            className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-bold text-slate-300"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: accent }}
            />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function SafetyPanel() {
  const items = [
    "Report card, profile, and comment",
    "Image moderation before public posts",
    "Private-by-default uploads",
    "Verified seller links only",
    "Ownership proof badges later",
  ];

  return (
    <div className="rounded-2xl border border-white/10 bg-[#151b24] p-4 shadow-xl">
      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
        Trust & safety
      </p>
      <h3 className="mt-2 text-2xl font-black text-white">Built for public sharing</h3>
      <p className="mt-3 text-sm font-bold leading-6 text-slate-400">
        Public social features need moderation from day one. Uploads stay private
        until shared, then media can be scanned and reported.
      </p>
      <div className="mt-4 grid gap-2">
        {items.map((item) => (
          <div
            key={item}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-bold text-slate-300"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function ExperienceTile({ copy, title }: { copy: string; title: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(21,27,36,0.92),rgba(8,12,18,0.92))] p-4 shadow-xl">
      <p className="text-lg font-black text-white">{title}</p>
      <p className="mt-2 text-sm font-bold leading-6 text-slate-400">{copy}</p>
    </div>
  );
}

function DashboardPanel({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#151b24] p-4 shadow-xl">
      <p className="mb-3 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
        {title}
      </p>
      <div className="grid gap-2">{children}</div>
    </div>
  );
}

function MiniStat({
  label,
  muted = false,
  value,
}: {
  label: string;
  muted?: boolean;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
      <span className="block truncate text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
        {label}
      </span>
      <span className={`mt-1 block truncate text-sm font-black ${muted ? "text-slate-300" : "text-white"}`}>
        {value}
      </span>
    </div>
  );
}

function GrailDisplay({
  accent,
  borderStyle,
  card,
  frameStyle,
  onSelect,
}: {
  accent: string;
  borderStyle: BorderStyle;
  card: Card;
  frameStyle: FrameStyle;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="holo-border mb-4 grid w-full gap-5 overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_18%_28%,rgba(255,255,255,0.12),transparent_26%),radial-gradient(circle_at_70%_0%,rgba(56,189,248,0.08),transparent_30%),linear-gradient(135deg,#151b24,#0d111a)] p-4 text-left shadow-2xl transition hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] lg:grid-cols-[240px_minmax(0,1fr)]"
    >
      <div className="h-[300px]">
        <CardPreview
          accent={accent}
          borderStyle={borderStyle}
          card={card}
          frameStyle={frameStyle}
          large
        />
      </div>
      <div className="self-center rounded-xl border border-white/10 bg-black/25 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
            Grail exhibit
          </p>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-black text-slate-300">
            {card.collection}
          </span>
        </div>
        <h3 className="mt-3 text-2xl font-black leading-tight text-white">
          {card.player}
        </h3>
        <p className="mt-1 text-sm text-slate-400">{card.team}</p>
        <p className="mt-5 max-w-xl text-sm font-bold leading-6 text-slate-200">
          {card.year} {card.brand} {card.set}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-full bg-[#ff5533] px-3 py-1 text-[10px] font-black text-white shadow-[0_0_30px_rgba(255,85,51,0.15)]">
            {card.status}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black text-slate-300">
            {card.grade}
          </span>
        </div>
      </div>
    </button>
  );
}

function EmptyGallery({
  accent,
  borderStyle,
  displayMode,
  frameStyle,
  onDisplayChange,
}: {
  accent: string;
  borderStyle: BorderStyle;
  displayMode: DisplayMode;
  frameStyle: FrameStyle;
  onDisplayChange: (mode: DisplayMode) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#151b26] shadow-xl">
      <div className="grid gap-0 lg:grid-cols-[1fr_260px]">
        <div className="p-5">
          <h3 className="mt-2 text-2xl font-black text-white">
            Start your roster.
          </h3>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <VaultAction label="Upload images" />
            <VaultAction label="Create collections" />
            <VaultAction label="Track value" />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/upload"
              className="inline-flex h-10 items-center rounded-md px-4 text-sm font-black text-white hover:brightness-110"
              style={{ backgroundColor: accent }}
            >
              Upload first cards
            </Link>
            {(["Grid", "Showcase", "Compact"] as DisplayMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => onDisplayChange(mode)}
                className={`h-10 rounded-md px-3 text-xs font-black ${
                  displayMode === mode
                    ? "bg-[#ff5533] text-white shadow-[0_0_30px_rgba(255,85,51,0.15)]"
                    : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-white/10 bg-black/20 p-4 lg:border-l lg:border-t-0">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
            Style
          </p>
          <div className={`mt-3 rounded-lg bg-black/25 p-3 ${borderClass(borderStyle)}`}>
            <div className={frameShellClass(frameStyle)}>
              {frameStyle !== "Card" ? (
                <div className="mb-2 rounded border border-black/10 bg-white px-2 py-1 text-[10px] font-black text-[#111722]">
                  {frameStyle} STYLE
                </div>
              ) : null}
              <div className="h-20 rounded-md bg-[#0f1218]" />
            </div>
          </div>
          <div
            className="mt-2 h-1.5 rounded-full"
            style={{ backgroundColor: accent }}
          />
          <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3 text-xs font-black text-slate-300">
            {displayMode}
          </div>
        </div>
      </div>
    </div>
  );
}

function VaultAction({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/25 p-3 text-sm font-black text-white">
      {label}
    </div>
  );
}

function QuickPanel({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/25 p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  );
}

function RailSection({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="border-b border-white/10 py-3 first:pt-0 last:border-b-0 last:pb-0">
      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
        {title}
      </p>
      {children}
    </section>
  );
}

function FilterSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: string[];
  value: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-md border border-white/10 bg-[#0c111a] px-2.5 text-xs font-black text-white outline-none focus:border-white/40"
      >
        {options.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
    </label>
  );
}

function CardTile({
  accent,
  borderStyle,
  card,
  mode,
  onClick,
  onDoubleClick,
  selected,
}: {
  accent: string;
  borderStyle: BorderStyle;
  card: Card;
  mode: DisplayMode;
  onClick: () => void;
  onDoubleClick: () => void;
  selected: boolean;
}) {
  const value = cardValue(card);
  const highlighted = isPremiumCard(card);
  const visibleTags = sanitizeTags(card.tags).filter((tag) =>
    ["Rookie", "Auto", "Patch", "Favorite"].includes(tag),
  );
  const selectedClass = selected
    ? "border-[#ff5533]/60 shadow-[0_0_0_2px_rgba(255,85,51,0.3),0_20px_40px_rgba(0,0,0,0.4)]"
    : "border-white/[0.08] shadow-[0_18px_38px_rgba(0,0,0,0.32)]";

  if (mode === "Compact") {
    return (
      <button
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        className={`grid grid-cols-[40px_minmax(0,1fr)_auto_auto_auto] items-center gap-3 border-b border-white/5 bg-[#0d111a] px-3 py-2.5 text-left transition hover:bg-white/[0.03] ${
          selected ? "shadow-[inset_3px_0_0_#ff5533]" : ""
        }`}
      >
        <div className="relative h-14 w-10 overflow-hidden rounded-md border border-white/10 bg-[#151b24]">
          <TileCardImage card={card} sizes="40px" accent={accent} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-white">{card.player}</p>
          <p className="truncate text-xs font-bold text-slate-400">{cardSubtitle(card)}</p>
        </div>
        <span className="hidden rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-black text-slate-300 sm:inline">
          {isDisplayGrade(card.grade) ? card.grade : "Raw"}
        </span>
        <span className="hidden text-right text-xs font-black text-white md:block">
          {value ? formatMoney(value) : ""}
        </span>
        <div className="flex items-center gap-2 justify-self-end">
          <span
            className={`size-2 rounded-full ${
              card.status === "For Trade"
                ? "bg-[#ff5533]"
                : card.status === "Wishlist"
                  ? "bg-amber-500"
                  : "bg-emerald-500"
            }`}
          />
          <span className="hidden text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 lg:inline">
            {card.status}
          </span>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`group h-full overflow-hidden rounded-2xl border bg-[linear-gradient(145deg,#151b24,#0d111a)] p-4 text-left transition duration-150 ease-out [contain-intrinsic-size:560px] [content-visibility:auto] hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] ${selectedClass} ${
        highlighted ? "ring-1 ring-[#ff5533]/25" : ""
      } ${tileBorderAccentClass(borderStyle)} ${
        mode === "Showcase"
          ? "grid items-center gap-5 sm:grid-cols-[320px_minmax(0,1fr)]"
          : "flex flex-col"
      }`}
    >
      <div className={`relative overflow-hidden rounded-xl border border-white/10 bg-[#0d111a] ${mode === "Showcase" ? "h-[320px]" : "h-[300px]"}`}>
        <TileCardImage
          card={card}
          accent={accent}
          sizes={mode === "Showcase" ? "320px" : "300px"}
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1"
          style={{ backgroundColor: card.color || accent }}
        />
      </div>
      <div
        className={
          mode === "Showcase"
            ? "min-w-0 rounded-xl border border-white/10 bg-black/25 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
            : "flex flex-1 flex-col pt-4"
        }
      >
        <div className="min-w-0">
          <p className={`${mode === "Showcase" ? "text-3xl" : "truncate text-base"} font-black leading-tight text-white`}>
            {card.player}
          </p>
          <p className={`${mode === "Showcase" ? "mt-2 text-sm" : "mt-1 truncate text-sm"} font-bold leading-5 text-slate-400`}>
            {card.year} {card.brand}
          </p>
        </div>
        <p className={`${mode === "Showcase" ? "mt-5 text-base leading-7" : "mt-3 line-clamp-2 text-sm leading-5"} font-bold text-slate-100`}>
          {cardSubtitle(card)}
        </p>
        {mode === "Showcase" && card.notes ? (
          <p className="mt-4 line-clamp-3 text-sm font-bold leading-6 text-slate-300">{card.notes}</p>
        ) : null}
        <div className="mt-auto pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {isDisplayGrade(card.grade) ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-black text-slate-200">
                {card.grade}
              </span>
            ) : null}
            {visibleTags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-black text-slate-300"
              >
                {tag}
              </span>
            ))}
            {card.status === "For Trade" ? (
              <span className="rounded-full border border-[#ff5533]/30 bg-[#ff5533]/15 px-2 py-1 text-[10px] font-black text-[#ffb199]">
                For trade
              </span>
            ) : null}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-sm font-black text-emerald-300">
              {value ? formatMoney(value) : ""}
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
              <span
                className={`size-2 rounded-full ${
                  card.status === "For Trade"
                    ? "bg-[#ff5533]"
                    : card.status === "Wishlist"
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                }`}
              />
              {card.status}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function TileCardImage({
  accent,
  card,
  sizes,
}: {
  accent: string;
  card: Card;
  sizes: string;
}) {
  const title = [card.player, card.team].filter(Boolean).join(" | ");

  if (!card.imageUrl) {
    return (
      <div className="grid h-full w-full place-items-center bg-[#0d111a] p-3">
        <div
          className="grid size-16 place-items-center rounded-full text-lg font-black text-white"
          style={{ backgroundColor: card.color || accent }}
        >
          {cardInitials(card.player)}
        </div>
      </div>
    );
  }

  return (
    <Image
      src={card.imageUrl}
      alt={title || "Card image"}
      fill
      unoptimized
      sizes={sizes}
      className="object-contain"
      style={{
        objectPosition: imagePosition(card),
        transform: `${imageScaleTransform(card)} ${imageRotateTransform(card)}`,
        transformOrigin: imagePosition(card),
      }}
    />
  );
}

function CardPreview({
  accent,
  borderStyle,
  card,
  frameStyle,
  imageFit = "cover",
  large = false,
  tight = false,
}: {
  accent: string;
  borderStyle: BorderStyle;
  card: Card;
  frameStyle: FrameStyle;
  imageFit?: "cover" | "contain";
  large?: boolean;
  tight?: boolean;
}) {
  const cardTitle = [card.player, card.team].filter(Boolean).join(" | ");

  return (
    <div
      className={
        tight
          ? "flex h-full items-center justify-center overflow-visible rounded-2xl bg-transparent p-0"
          : `flex h-full items-center justify-center overflow-visible rounded-lg bg-black/20 p-2.5 ${previewBorderClass(borderStyle)}`
      }
      style={tight ? undefined : previewBorderStyle(borderStyle, card.color || accent)}
    >
      <div className="aspect-[5/7] h-full max-h-full">
        <div
          className={`${frameShellClass(frameStyle)} relative flex h-full flex-col`}
          style={frameShellStyle(frameStyle, card.color || accent)}
        >
          <div
            className={`h-full overflow-hidden rounded-lg ${imageWindowClass(frameStyle)} ${innerFrameClass(frameStyle)}`}
            title={cardTitle}
          >
            {card.imageUrl ? (
              <div className="relative h-full w-full bg-transparent">
                <EditedCardImage
                  card={card}
                  sizes={large ? "280px" : "220px"}
                  fit={imageFit}
                  accent={accent}
                />
              </div>
            ) : (
              <div className="flex h-full flex-col justify-between bg-black/35 p-2.5">
                <div
                  className="h-1.5 rounded-full"
                  style={{ backgroundColor: card.color || accent }}
                />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/70">
                    {card.sport}
                  </p>
                  <p className="mt-2 text-lg font-black leading-tight text-white">
                    {card.player}
                  </p>
                </div>
                <div className="flex items-center justify-between text-[10px] font-black text-white">
                  <span>{card.year}</span>
                  <span>{card.brand}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function cardInitials(value: string) {
  const initials = value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("");

  return initials || "CR";
}

function MiniWallPreview({ accent, card }: { accent: string; card: Card }) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-white/10 bg-black/30 p-1.5 shadow-[0_12px_24px_rgba(0,0,0,0.35)]">
      <div
        className="absolute inset-x-3 bottom-1 h-1 rounded-full"
        style={{
          background: `linear-gradient(90deg, ${card.color || accent}, #f8e71c, #20e3b2, #38bdf8, #ec4899)`,
        }}
      />
      <div className="relative mx-auto h-[calc(100%-8px)] max-w-[62px] overflow-hidden rounded-md bg-[#0d111a]">
        <EditedCardImage card={card} sizes="72px" accent={accent} />
      </div>
    </div>
  );
}

function CleanCardThumb({ accent, card }: { accent: string; card: Card }) {
  return (
    <div className="relative aspect-[5/7] w-full overflow-hidden rounded-lg bg-[#0d111a] shadow-[0_14px_30px_rgba(0,0,0,0.42)] ring-1 ring-white/15">
      <div
        className="absolute inset-x-0 bottom-0 z-10 h-1"
        style={{
          background: `linear-gradient(90deg, ${card.color || accent}, #20e3b2, #38bdf8, #ec4899)`,
        }}
      />
      <EditedCardImage card={card} sizes="120px" accent={accent} />
    </div>
  );
}

function EditedCardImage({
  accent,
  card,
  fit = "contain",
  sizes,
}: {
  accent: string;
  card: Card;
  fit?: "cover" | "contain";
  sizes: string;
}) {
  const cardTitle = [card.player, card.team].filter(Boolean).join(" | ");

  if (!card.imageUrl) {
    return (
      <div
        className="grid h-full w-full place-items-center p-2 text-center text-[10px] font-black text-white"
        style={{ backgroundColor: card.color || accent }}
      >
        {card.player || "CR"}
      </div>
    );
  }

  return (
    <Image
      src={card.imageUrl}
      alt={cardTitle || "Card image"}
      fill
      unoptimized
      sizes={sizes}
      className={fit === "contain" ? "object-contain" : "object-cover"}
      style={{
        objectPosition: imagePosition(card),
        transform: `${imageScaleTransform(card)} ${imageRotateTransform(card)}`,
        transformOrigin: imagePosition(card),
      }}
    />
  );
}

function tileBorderClass(borderStyle: BorderStyle) {
  if (borderStyle === "Chrome") {
    return "border border-cyan-100/30 bg-[linear-gradient(145deg,rgba(255,255,255,0.10),rgba(56,189,248,0.07),rgba(255,255,255,0.03))] shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(0,0,0,0.5),0_18px_42px_rgba(0,0,0,0.35)]";
  }

  if (borderStyle === "Glow") {
    return "border border-white/15 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.11),transparent_42%),linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.015))] shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_18px_42px_rgba(0,0,0,0.38)]";
  }

  return "border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.06),rgba(15,23,42,0.92))] shadow-[0_18px_38px_rgba(0,0,0,0.32)]";
}

function tileBorderAccentClass(borderStyle: BorderStyle) {
  if (borderStyle === "Chrome") {
    return "shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_18px_38px_rgba(0,0,0,0.34)]";
  }

  if (borderStyle === "Glow") {
    return "shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_0_30px_rgba(255,85,51,0.15),0_18px_38px_rgba(0,0,0,0.36)]";
  }

  return "";
}

function previewBorderClass(borderStyle: BorderStyle) {
  if (borderStyle === "Chrome") {
    return "border border-white/25 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_18px_38px_rgba(0,0,0,0.32)]";
  }

  if (borderStyle === "Glow") {
    return "border border-white/15 bg-white/[0.03]";
  }

  return "border border-white/10 bg-[#101621] shadow-[0_18px_38px_rgba(0,0,0,0.34)]";
}

function previewBorderStyle(borderStyle: BorderStyle, accent: string) {
  if (borderStyle !== "Glow") return undefined;

  return {
    boxShadow: `0 0 0 1px rgba(255,255,255,0.08), 0 0 28px ${accent}70, 0 0 70px ${accent}24, 0 18px 40px rgba(0,0,0,0.38)`,
  };
}

function borderClass(borderStyle: BorderStyle) {
  return tileBorderClass(borderStyle);
}

function frameShellClass(frameStyle: FrameStyle) {
  if (frameStyle === "Gradient") {
    return "rounded-2xl p-1.5 shadow-2xl";
  }

  if (frameStyle === "Sunset") {
    return "rounded-2xl p-1.5 shadow-2xl";
  }

  if (frameStyle === "Stand") {
    return "relative rounded-2xl border border-white/25 bg-[linear-gradient(135deg,rgba(255,255,255,0.34),rgba(255,255,255,0.06))] p-1.5 shadow-2xl before:absolute before:-bottom-4 before:left-1/2 before:h-8 before:w-24 before:-translate-x-1/2 before:skew-x-[-18deg] before:rounded before:border before:border-white/20 before:bg-white/10 before:content-['']";
  }

  return "rounded-2xl border border-white/10 bg-[#111722] p-2 shadow-2xl";
}

function frameShellStyle(frameStyle: FrameStyle, accent: string) {
  if (frameStyle === "Gradient") {
    return {
      background: `linear-gradient(135deg, ${accent}, #f8e71c 28%, #20e3b2 54%, #38bdf8 74%, #ec4899)`,
    };
  }

  if (frameStyle === "Sunset") {
    return {
      background: `linear-gradient(135deg, ${accent}, #ffb703 34%, #fb7185 68%, #38bdf8)`,
    };
  }

  return undefined;
}

function innerFrameClass(frameStyle: FrameStyle) {
  if (frameStyle === "Gradient" || frameStyle === "Sunset") {
    return "border border-white/10";
  }

  if (frameStyle === "Stand") {
    return "border border-white/25";
  }

  return "border border-black/20";
}

function imageWindowClass(frameStyle: FrameStyle) {
  if (frameStyle === "Gradient" || frameStyle === "Sunset") {
    return "bg-transparent";
  }

  if (frameStyle === "Stand") {
    return "bg-white/5";
  }

  return "bg-[#0d111a]";
}

function imagePosition(card: Card) {
  return `${card.imageX ?? 50}% ${card.imageY ?? 50}%`;
}

function imageScaleTransform(card: Card) {
  return `scale(${(card.imageZoom ?? 100) / 100})`;
}

function imageRotateTransform(card: Card) {
  return `rotate(${card.imageRotation ?? 0}deg)`;
}

function csvCell(value: Card[keyof Card]) {
  const text = Array.isArray(value)
    ? value.join("|")
    : value === undefined || value === null
      ? ""
      : String(value);

  return `"${text.replaceAll("\"", "\"\"")}"`;
}

function toggleTag(tags: CardTag[] | undefined, tag: CardTag) {
  const nextTags = sanitizeTags(tags);
  return nextTags.includes(tag)
    ? nextTags.filter((item) => item !== tag)
    : [...nextTags, tag];
}

function rotateValue(current: number, change: number) {
  const next = ((current + change) % 360 + 360) % 360;
  return next > 180 ? next - 360 : next;
}

function sanitizeTags(tags: CardTag[] | undefined) {
  return (tags ?? []).filter((tag): tag is CardTag =>
    cardTags.includes(tag as CardTag),
  );
}

function isPremiumCard(card: Card) {
  return card.isChase || card.tags?.includes("Favorite");
}

function moneyValue(value?: string) {
  if (!value) return 0;
  const number = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function cardValue(card: Card) {
  return moneyValue(card.estimatedValue) || moneyValue(card.purchasePrice);
}

function cardSubtitle(card: Card) {
  const set = card.set && card.brand && card.set.includes(card.brand)
    ? card.set
    : [card.brand, card.set].filter(Boolean).join(" ");

  return [card.year, set, card.cardNumber ? `#${card.cardNumber}` : ""]
    .filter(Boolean)
    .join(" ");
}

function isDisplayGrade(grade?: string) {
  if (!grade || grade === "Raw") return false;
  return !/not professionally graded|ungraded/i.test(grade);
}

function cardSearchText(card: Card) {
  return [
    card.year,
    card.brand,
    card.set,
    card.player,
    card.cardNumber,
    card.parallel,
    card.grade && card.grade !== "Raw" ? card.grade : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function ebaySearchUrl(card: Card) {
  return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(cardSearchText(card))}`;
}

function certLookupUrl(card: Card) {
  const grader = (card.gradingCompany || card.grade || "").toLowerCase();
  const cert = encodeURIComponent(card.certNumber || "");

  if (grader.includes("bgs") || grader.includes("beckett")) {
    return `https://www.beckett.com/grading/card-lookup?item_type=BGS&item_id=${cert}`;
  }

  if (grader.includes("sgc")) {
    return "https://www.gosgc.com/cert-code-lookup";
  }

  return cert
    ? `https://www.psacard.com/cert/${cert}`
    : "https://www.psacard.com/cert";
}

function gradingDecisionText(card: Card) {
  const cost = moneyValue(card.purchasePrice) + moneyValue(card.gradingFee);
  const value = cardValue(card);

  if (!cost || !value) return "Review";
  if (value > cost * 1.5) return "Good";
  if (value > cost) return "Close";
  return "Skip";
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/25 p-2.5">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function TagRow({ compact = false, tags }: { compact?: boolean; tags: CardTag[] }) {
  return (
    <div className={`${compact ? "mt-0" : "mt-3"} flex flex-wrap gap-1.5`}>
      {tags.slice(0, 4).map((tag) => (
        <span
          key={tag}
          className={`rounded-full border border-white/10 bg-white/5 font-black text-slate-300 ${
            compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[10px]"
          }`}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

function ColorSwatches({
  activeColor,
  onChange,
}: {
  activeColor: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        Quick colors
      </p>
      <div className="grid grid-cols-6 gap-2">
        {accentPalette.map((color) => {
          const active = color.toLowerCase() === activeColor.toLowerCase();

          return (
            <button
              key={color}
              type="button"
              onClick={() => onChange(color)}
              aria-label={`Use ${color}`}
              className={`h-8 rounded-md border transition ${
                active ? "border-white shadow-[0_0_0_2px_rgba(255,255,255,0.18)]" : "border-white/15"
              }`}
              style={{ backgroundColor: color }}
            />
          );
        })}
      </div>
    </div>
  );
}

function RangeField({
  label,
  max = 100,
  min = 0,
  onChange,
  value,
}: {
  label: string;
  max?: number;
  min?: number;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <label>
      <div className="mb-1 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-white"
      />
    </label>
  );
}

function EditField({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
