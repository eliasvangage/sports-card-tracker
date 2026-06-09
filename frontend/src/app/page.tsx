"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type ThemeName = "Arena" | "Chrome" | "Hardwood";
type DisplayMode = "Grid" | "Showcase" | "Compact";
type BorderStyle = "Glow" | "Chrome" | "Matte";
type FrameStyle = "Card" | "PSA" | "BGS";
type SortMode = "Newest" | "Player" | "Year";

type Card = {
  id: string;
  player: string;
  sport: string;
  team: string;
  year: string;
  brand: string;
  set: string;
  status: "Vaulted" | "Wishlist" | "For Trade";
  grade: string;
  color: string;
  collection: string;
  imageUrl?: string;
  estimatedValue?: string;
  purchasePrice?: string;
  salePrice?: string;
  saleStatus?: "Holding" | "Listed" | "Sold";
  frameStyle?: FrameStyle;
};

const themes: Record<ThemeName, { bg: string; panel: string; accent: string }> = {
  Arena: {
    bg: "bg-[#0f1218]",
    panel: "bg-[#151b26]",
    accent: "#ff4d1c",
  },
  Chrome: {
    bg: "bg-[#111827]",
    panel: "bg-[#1f2937]",
    accent: "#38bdf8",
  },
  Hardwood: {
    bg: "bg-[#24160d]",
    panel: "bg-[#342013]",
    accent: "#f59e0b",
  },
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
    if (typeof window === "undefined") return "Glow";
    return (localStorage.getItem("cardroster.borderStyle") as BorderStyle) ?? "Glow";
  });
  const [frameStyle, setFrameStyle] = useState<FrameStyle>(() => {
    if (typeof window === "undefined") return "Card";
    return (localStorage.getItem("cardroster.frameStyle") as FrameStyle) ?? "Card";
  });
  const [sortMode, setSortMode] = useState<SortMode>("Newest");
  const [query, setQuery] = useState("");
  const [sport, setSport] = useState("All");
  const [status, setStatus] = useState("All");
  const [collection, setCollection] = useState("All");
  const [newCollection, setNewCollection] = useState("");
  const [savedCollections, setSavedCollections] = useState<string[]>(() => {
    if (typeof window === "undefined") return ["Main Collection"];
    return JSON.parse(
      localStorage.getItem("cardroster.collections") ?? "[\"Main Collection\"]",
    );
  });
  const [collectionName, setCollectionName] = useState(() => {
    if (typeof window === "undefined") return "Elias Vault";
    return localStorage.getItem("cardroster.collectionName") ?? "Elias Vault";
  });
  const [savedCards, setSavedCards] = useState<Card[]>(() => {
    if (typeof window === "undefined") return [];
    const cards = JSON.parse(localStorage.getItem("cardroster.cards") ?? "[]") as Card[];
    return cards.map((card) => ({
      ...card,
      collection: card.collection ?? "Main Collection",
    }));
  });
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    localStorage.setItem("cardroster.collectionName", collectionName);
  }, [collectionName]);

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
  const inventoryValue = allCards.reduce(
    (total, card) => total + moneyValue(card.estimatedValue),
    0,
  );
  const costBasis = allCards.reduce(
    (total, card) => total + moneyValue(card.purchasePrice),
    0,
  );
  const soldValue = allCards.reduce(
    (total, card) => total + moneyValue(card.salePrice),
    0,
  );
  const listedCount = allCards.filter((card) => card.saleStatus === "Listed").length;
  const soldCount = allCards.filter((card) => card.saleStatus === "Sold").length;

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

      return matchesSearch && matchesSport && matchesStatus && matchesCollection;
    });

    return matches.toSorted((a, b) => {
      if (sortMode === "Player") return a.player.localeCompare(b.player);
      if (sortMode === "Year") return b.year.localeCompare(a.year);
      return 0;
    });
  }, [allCards, collection, query, sortMode, sport, status]);

  const selectedCard =
    allCards.find((card) => card.id === selectedId) ??
    filteredCards[0];

  function cycleDisplayMode() {
    const modes: DisplayMode[] = ["Grid", "Showcase", "Compact"];
    const nextMode = modes[(modes.indexOf(displayMode) + 1) % modes.length];
    setDisplayMode(nextMode);
  }

  function cycleTheme() {
    const themeNames: ThemeName[] = ["Arena", "Chrome", "Hardwood"];
    const nextTheme = themeNames[(themeNames.indexOf(theme) + 1) % themeNames.length];
    setTheme(nextTheme);
  }

  function deleteCard(id: string) {
    const nextCards = savedCards.filter((card) => card.id !== id);
    setSavedCards(nextCards);
    localStorage.setItem("cardroster.cards", JSON.stringify(nextCards));
    setSelectedId(nextCards[0]?.id ?? "");
  }

  function addCollection() {
    const cleanName = newCollection.trim();
    if (!cleanName || savedCollections.includes(cleanName)) return;

    const nextCollections = [...savedCollections, cleanName];
    setSavedCollections(nextCollections);
    localStorage.setItem("cardroster.collections", JSON.stringify(nextCollections));
    setNewCollection("");
  }

  return (
    <main className={`min-h-screen ${activeTheme.bg} text-white`}>
      <div className="pointer-events-none fixed inset-0 opacity-40">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:44px_44px]" />
        <div
          className="absolute left-1/2 top-0 h-64 w-1/2 -translate-x-1/2 blur-3xl"
          style={{ backgroundColor: `${activeTheme.accent}22` }}
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

          <nav className="hidden items-center gap-1 rounded-md border border-white/10 bg-white/5 p-1 text-xs font-bold text-slate-200 sm:flex">
            <button className="rounded bg-white px-3 py-1.5 text-[#111722]">
              Gallery
            </button>
            <button
              onClick={cycleDisplayMode}
              className="rounded px-3 py-1.5 hover:bg-white/10"
            >
              Display: {displayMode}
            </button>
            <Link className="rounded px-3 py-1.5 hover:bg-white/10" href="/upload">
              Upload
            </Link>
            <button
              onClick={cycleTheme}
              className="rounded px-3 py-1.5 hover:bg-white/10"
            >
              Theme: {theme}
            </button>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6">
        <div className={`relative overflow-hidden rounded-xl border border-white/10 ${activeTheme.panel} p-4 shadow-2xl sm:p-5`}>
          <div
            className="absolute inset-x-0 top-0 h-1"
            style={{ backgroundColor: activeTheme.accent }}
          />
          <div
            className="absolute right-0 top-0 h-40 w-40 rounded-bl-full opacity-20"
            style={{ backgroundColor: activeTheme.accent }}
          />

          <div className="relative grid gap-5 lg:grid-cols-[1fr_360px] lg:items-stretch">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-white/55">
                Live collection room
              </p>
              <h2 className="mt-2 max-w-3xl text-3xl font-black leading-tight tracking-normal sm:text-4xl">
                Build, style, and run your card vault.
              </h2>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href="/upload"
                  className="inline-flex h-10 items-center rounded-md px-4 text-sm font-black text-white shadow-lg transition hover:brightness-110"
                  style={{ backgroundColor: activeTheme.accent }}
                >
                  Upload cards
                </Link>
                <button
                  onClick={cycleDisplayMode}
                  className="inline-flex h-10 items-center rounded-md border border-white/10 bg-white/5 px-4 text-sm font-black text-slate-200 hover:bg-white/10"
                >
                  Preview {displayMode}
                </button>
              </div>
              <div className="mt-5 grid max-w-3xl gap-2 sm:grid-cols-4">
                <HeroMetric label="Cards saved" value={allCards.length.toString()} />
                <HeroMetric label="Inventory" value={formatMoney(inventoryValue)} />
                <HeroMetric label="Listed" value={listedCount.toString()} />
                <HeroMetric label="Sold" value={formatMoney(soldValue)} />
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/25 p-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                  Control room
                </p>
                <span className="rounded bg-white/10 px-2 py-1 text-[10px] font-black text-slate-300">
                  {theme}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <ControlTile label="Display" value={displayMode} />
                <ControlTile label="Border" value={borderStyle} />
                <ControlTile label="Frame" value={frameStyle} />
                <ControlTile label="Theme" value={theme} />
              </div>
              <label className="mt-3 block text-xs font-bold text-slate-200">
                Collection name
              </label>
              <input
                value={collectionName}
                onChange={(event) => setCollectionName(event.target.value)}
                className="mt-1.5 h-9 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-white/40"
              />
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <ScoreStat label="Shown" value={filteredCards.length.toString()} />
                <ScoreStat label="Cost" value={formatMoney(costBasis)} />
                <ScoreStat label="Sold" value={soldCount.toString()} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1440px] gap-4 px-4 pb-8 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)_280px]">
        <aside className={`h-fit rounded-lg border border-white/10 ${activeTheme.panel} p-3 shadow-xl lg:sticky lg:top-20`}>
          <label className="mb-1.5 block text-xs font-bold text-slate-100">
            Find a card
          </label>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-9 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-white/40"
            placeholder="Player, team, year..."
          />

          <ControlGroup title="Sports">
            {sports.map((item) => (
              <FilterButton
                key={item}
                active={sport === item}
                label={item}
                accent={activeTheme.accent}
                onClick={() => setSport(item)}
              />
            ))}
          </ControlGroup>

          <ControlGroup title="Status">
            {statuses.map((item) => (
              <FilterButton
                key={item}
                active={status === item}
                label={item}
                accent={activeTheme.accent}
                onClick={() => setStatus(item)}
              />
            ))}
          </ControlGroup>

          <ControlGroup title="Collections">
            {collections.map((item) => (
              <FilterButton
                key={item}
                active={collection === item}
                label={item}
                accent={activeTheme.accent}
                onClick={() => setCollection(item)}
              />
            ))}
          </ControlGroup>

          <div className="mt-3 grid gap-2">
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

          <ControlGroup title="Display theme">
            {(["Arena", "Chrome", "Hardwood"] as ThemeName[]).map((item) => (
              <FilterButton
                key={item}
                active={theme === item}
                label={item}
                accent={activeTheme.accent}
                onClick={() => setTheme(item)}
              />
            ))}
          </ControlGroup>

          <ControlGroup title="Card border">
            {(["Glow", "Chrome", "Matte"] as BorderStyle[]).map((item) => (
              <FilterButton
                key={item}
                active={borderStyle === item}
                label={item}
                accent={activeTheme.accent}
                onClick={() => setBorderStyle(item)}
              />
            ))}
          </ControlGroup>

          <ControlGroup title="Card frame">
            {(["Card", "PSA", "BGS"] as FrameStyle[]).map((item) => (
              <FilterButton
                key={item}
                active={frameStyle === item}
                label={item}
                accent={activeTheme.accent}
                onClick={() => setFrameStyle(item)}
              />
            ))}
          </ControlGroup>
        </aside>

        <section>
          <div className="mb-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/55">
                Display cases
              </p>
              <h3 className="mt-1 text-xl font-black">Gallery floor</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                className="h-9 rounded-md border border-white/10 bg-white/5 px-3 text-xs font-black text-slate-200 outline-none"
              >
                <option>Newest</option>
                <option>Player</option>
                <option>Year</option>
              </select>
              {(["Grid", "Showcase", "Compact"] as DisplayMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setDisplayMode(mode)}
                  className={`h-9 rounded-md px-3 text-xs font-black transition ${
                    displayMode === mode
                      ? "bg-white text-[#111722]"
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
                  borderStyle={borderStyle}
                  frameStyle={frameStyle}
                  mode={displayMode}
                  selected={selectedCard?.id === card.id}
                  onClick={() => setSelectedId(card.id)}
                />
              ))}
            </div>
          )}
        </section>

        <aside className={`h-fit rounded-lg border border-white/10 ${activeTheme.panel} p-3 shadow-xl lg:sticky lg:top-20`}>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/55">
            Selected card
          </p>
          {selectedCard ? (
            <>
              <div className="mt-4">
                <CardPreview
                  card={selectedCard}
                  accent={activeTheme.accent}
                  borderStyle={borderStyle}
                  frameStyle={selectedCard.frameStyle ?? frameStyle}
                  large
                />
              </div>
              <div className="mt-5 space-y-3">
                <Detail label="Player" value={selectedCard.player} />
                <Detail label="Collection" value={selectedCard.collection} />
                <Detail label="Team" value={selectedCard.team} />
                <Detail label="Card" value={`${selectedCard.year} ${selectedCard.brand}`} />
                <Detail label="Set" value={selectedCard.set} />
                <Detail label="Grade" value={selectedCard.grade} />
                <Detail label="Status" value={selectedCard.status} />
                <Detail
                  label="Value"
                  value={formatMoney(moneyValue(selectedCard.estimatedValue))}
                />
                <Detail
                  label="Cost"
                  value={formatMoney(moneyValue(selectedCard.purchasePrice))}
                />
                <Detail label="Sale" value={selectedCard.saleStatus ?? "Holding"} />
              </div>
              <button
                onClick={() => deleteCard(selectedCard.id)}
                className="mt-4 h-10 w-full rounded-md border border-red-400/20 bg-red-500/10 text-sm font-bold text-red-200 hover:bg-red-500/20"
              >
                Delete card
              </button>
            </>
          ) : (
            <div className="mt-4 space-y-3">
              <QuickPanel label="Display" value={displayMode} />
              <QuickPanel label="Theme" value={theme} />
              <QuickPanel label="Border" value={borderStyle} />
              <QuickPanel label="Frame" value={frameStyle} />
              <QuickPanel label="Cards" value={allCards.length.toString()} />
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}

function displayModeClasses(mode: DisplayMode) {
  if (mode === "Compact") {
    return "grid gap-3";
  }

  if (mode === "Showcase") {
    return "grid gap-4 xl:grid-cols-2";
  }

  return "grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4";
}

function ScoreStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/30 px-2 py-2">
      <p className="truncate text-base font-black leading-none text-white">{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
    </div>
  );
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

function ControlTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/25 p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-black text-white">{value}</p>
    </div>
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
            Start your vault.
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
                    ? "bg-white text-[#111722]"
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

function ControlGroup({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div className="mt-4 space-y-1.5">
      <p className="text-xs font-bold text-slate-100">{title}</p>
      {children}
    </div>
  );
}

function FilterButton({
  active = false,
  accent,
  label,
  onClick,
}: {
  active?: boolean;
  accent: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-md px-2.5 py-1.5 text-left text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
      style={active ? { backgroundColor: accent, color: "white" } : undefined}
    >
      {label}
    </button>
  );
}

function CardTile({
  accent,
  borderStyle,
  card,
  frameStyle,
  mode,
  onClick,
  selected,
}: {
  accent: string;
  borderStyle: BorderStyle;
  card: Card;
  frameStyle: FrameStyle;
  mode: DisplayMode;
  onClick: () => void;
  selected: boolean;
}) {
  if (mode === "Compact") {
    return (
      <button
        onClick={onClick}
        className={`flex items-center justify-between gap-4 rounded-lg bg-[#151b26] p-2.5 text-left transition hover:-translate-y-0.5 ${
          selected ? "border-white/60" : "border-white/10"
        } ${borderClass(borderStyle)}`}
      >
        <div className="flex items-center gap-3">
          <div
            className="h-11 w-8 rounded border border-white/20 bg-cover bg-center"
            style={
              card.imageUrl
                ? { backgroundImage: `url(${card.imageUrl})` }
                : { backgroundColor: card.color }
            }
          />
          <div>
            <p className="text-sm font-black text-white">{card.player}</p>
            <p className="text-xs text-slate-400">
              {card.year} {card.brand} | {card.grade}
            </p>
          </div>
        </div>
        <span className="rounded bg-white/5 px-2 py-1 text-[11px] font-black text-slate-300">
          {card.status}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`group rounded-lg bg-[#151b26] p-3 text-left shadow-xl transition hover:-translate-y-0.5 ${
        selected ? "border-white/60" : "border-white/10"
      } ${borderClass(borderStyle)} ${
        mode === "Showcase" ? "grid gap-4 sm:grid-cols-[150px_1fr]" : ""
      }`}
    >
      <CardPreview
        card={card}
        accent={accent}
        borderStyle={borderStyle}
        frameStyle={card.frameStyle ?? frameStyle}
        large={mode === "Showcase"}
      />
      <div className={mode === "Showcase" ? "self-center" : "mt-3"}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-black text-white">{card.player}</p>
            <p className="mt-1 text-xs text-slate-400">{card.team}</p>
          </div>
          <span className="rounded bg-white/5 px-2 py-1 text-[11px] font-black text-slate-300">
            {card.status}
          </span>
        </div>
        <p className="mt-3 text-xs font-bold text-slate-300">
          {card.year} {card.brand} {card.set}
        </p>
        <p className="mt-1 text-xs text-slate-500">{card.grade}</p>
      </div>
    </button>
  );
}

function CardPreview({
  accent,
  borderStyle,
  card,
  frameStyle,
  large = false,
}: {
  accent: string;
  borderStyle: BorderStyle;
  card: Card;
  frameStyle: FrameStyle;
  large?: boolean;
}) {
  const cardTitle = [card.player, card.team].filter(Boolean).join(" | ");

  return (
    <div className={`rounded-md bg-black/30 p-2.5 ${borderClass(borderStyle)}`}>
      <div className={`mx-auto ${large ? "w-full max-w-48" : "w-full"}`}>
        <div className={frameShellClass(frameStyle)}>
          {frameStyle !== "Card" ? (
            <div className="mb-2 grid grid-cols-[1fr_auto] items-center gap-2 rounded border border-black/10 bg-white px-2 py-1 text-[#111722]">
              <div>
                <p className="truncate text-[10px] font-black">{card.player}</p>
                <p className="truncate text-[9px] font-bold text-slate-500">
                  {card.year} {card.brand}
                </p>
              </div>
              <div className="rounded bg-[#e11d48] px-1.5 py-0.5 text-[10px] font-black text-white">
                {frameStyle}
              </div>
            </div>
          ) : null}
          <div
            className="aspect-[3/4] overflow-hidden rounded-md border border-black/20 bg-[#202939]"
            title={cardTitle}
          >
            {card.imageUrl ? (
              <div
                className="h-full w-full bg-cover bg-center"
                style={{ backgroundImage: `url(${card.imageUrl})` }}
              />
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

function borderClass(borderStyle: BorderStyle) {
  if (borderStyle === "Chrome") {
    return "border border-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_16px_40px_rgba(0,0,0,0.25)]";
  }

  if (borderStyle === "Matte") {
    return "border border-white/10 shadow-xl";
  }

  return "border border-white/15 shadow-[0_0_26px_rgba(255,77,28,0.14),0_18px_40px_rgba(0,0,0,0.3)]";
}

function frameShellClass(frameStyle: FrameStyle) {
  if (frameStyle === "PSA") {
    return "rounded-lg border border-white/50 bg-slate-100 p-2 shadow-2xl";
  }

  if (frameStyle === "BGS") {
    return "rounded-lg border border-yellow-300/70 bg-[#14100a] p-2 shadow-2xl";
  }

  return "rounded-lg bg-transparent";
}

function moneyValue(value?: string) {
  if (!value) return 0;
  const number = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(number) ? number : 0;
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
