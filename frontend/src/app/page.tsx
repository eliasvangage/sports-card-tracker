"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";

type ThemeName = "Arena" | "Chrome" | "Hardwood";
type DisplayMode = "Grid" | "Showcase" | "Compact";
type BorderStyle = "Soft" | "Chrome" | "Glow";
type FrameStyle = "Card" | "Gradient" | "Sunset" | "Stand";
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
  borderStyle?: BorderStyle;
};

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
  const [showMoney, setShowMoney] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("cardroster.showMoney") !== "false";
  });
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
      frameStyle: readFrameStyle(card.frameStyle ?? null),
    }));
  });
  const [selectedId, setSelectedId] = useState("");
  const [grailId, setGrailId] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("cardroster.grailId") ?? "";
  });

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

  useEffect(() => {
    localStorage.setItem("cardroster.grailId", grailId);
  }, [grailId]);

  useEffect(() => {
    localStorage.setItem("cardroster.showMoney", String(showMoney));
  }, [showMoney]);

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
  const soldValue = allCards.reduce(
    (total, card) => total + moneyValue(card.salePrice),
    0,
  );
  const listedCount = allCards.filter((card) => card.saleStatus === "Listed").length;

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
  const grailCard = allCards.find((card) => card.id === grailId) ?? allCards[0];

  function cycleDisplayMode() {
    const modes: DisplayMode[] = ["Grid", "Showcase", "Compact"];
    const nextMode = modes[(modes.indexOf(displayMode) + 1) % modes.length];
    setDisplayMode(nextMode);
  }

  function deleteCard(id: string) {
    const nextCards = savedCards.filter((card) => card.id !== id);
    setSavedCards(nextCards);
    localStorage.setItem("cardroster.cards", JSON.stringify(nextCards));
    setSelectedId(nextCards[0]?.id ?? "");
  }

  function updateCard(id: string, updates: Partial<Card>) {
    const nextCards = savedCards.map((card) =>
      card.id === id ? { ...card, ...updates } : card,
    );
    setSavedCards(nextCards);
    localStorage.setItem("cardroster.cards", JSON.stringify(nextCards));
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

          <nav className="hidden items-center gap-1 rounded-md border border-white/10 bg-white/5 p-1 text-xs font-bold text-slate-200 sm:flex">
            <button className="rounded bg-white px-3 py-1.5 text-[#111722]">
              Gallery
            </button>
            <Link className="rounded px-3 py-1.5 hover:bg-white/10" href="/upload">
              Upload
            </Link>
            <button className="rounded px-3 py-1.5 hover:bg-white/10">
              Studio
            </button>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6">
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.08),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015))] p-4 shadow-2xl sm:p-5">
          <div
            className="absolute inset-x-0 top-0 h-1"
            style={{ backgroundColor: activeTheme.accent }}
          />
          <div className="relative grid gap-5 lg:grid-cols-[1fr_320px] lg:items-stretch">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-white/55">
                Live collection room
              </p>
              <h2 className="mt-2 max-w-3xl text-3xl font-black leading-tight tracking-normal sm:text-4xl">
                Browse, style, and manage your card vault.
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
              <div className="mt-5 grid max-w-2xl gap-2 sm:grid-cols-4">
                <HeroMetric label="Cards saved" value={allCards.length.toString()} />
                <HeroMetric
                  label="Inventory"
                  value={showMoney ? formatMoney(inventoryValue) : "Hidden"}
                />
                <HeroMetric label="Listed" value={listedCount.toString()} />
                <HeroMetric
                  label="Sold"
                  value={showMoney ? formatMoney(soldValue) : "Hidden"}
                />
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/30 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                  Display style
                </p>
                <span className="rounded bg-white/10 px-2 py-1 text-[10px] font-black text-slate-300">
                  {frameStyle}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <StyleSwatch label="Card" active={frameStyle === "Card"} />
                <StyleSwatch label="Gradient" active={frameStyle === "Gradient"} rainbow />
                <StyleSwatch label="Stand" active={frameStyle === "Stand"} glass />
              </div>
              <button
                onClick={() => setShowMoney((current) => !current)}
                className="mt-3 h-9 w-full rounded-md border border-white/10 bg-white/5 text-xs font-black text-slate-200 hover:bg-white/10"
              >
                {showMoney ? "Hide values" : "Show values"}
              </button>
              <label className="mt-3 block text-xs font-bold text-slate-200">
                Collection name
              </label>
              <input
                value={collectionName}
                onChange={(event) => setCollectionName(event.target.value)}
                className="mt-1.5 h-9 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-white/40"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1440px] gap-4 px-4 pb-8 sm:px-6 lg:grid-cols-[230px_minmax(0,1fr)_300px]">
        <aside className={`h-fit rounded-lg border border-white/10 ${activeTheme.panel} p-3 shadow-xl lg:sticky lg:top-20`}>
          <RailSection title="Find">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-9 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-white/40"
              placeholder="Player, team, year..."
            />
          </RailSection>

          <RailSection title="Filter cards">
            <ControlGroup title="Sport">
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

            <ControlGroup title="Collection">
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
          </RailSection>

          <RailSection title="Add collection">
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
          </RailSection>

          <RailSection title="Default style">
            <ControlGroup title="Theme">
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

            <ControlGroup title="Finish">
              {(["Soft", "Chrome", "Glow"] as BorderStyle[]).map((item) => (
                <FilterButton
                  key={item}
                  active={borderStyle === item}
                  label={item}
                  accent={activeTheme.accent}
                  onClick={() => setBorderStyle(item)}
                />
              ))}
            </ControlGroup>

            <ControlGroup title="Frame">
              {(["Card", "Gradient", "Sunset", "Stand"] as FrameStyle[]).map((item) => (
                <FilterButton
                  key={item}
                  active={frameStyle === item}
                  label={item}
                  accent={activeTheme.accent}
                  onClick={() => setFrameStyle(item)}
                />
              ))}
            </ControlGroup>
          </RailSection>
        </aside>

        <section className="min-w-0 rounded-xl border border-white/10 bg-black/15 p-3 shadow-2xl">
          {grailCard ? (
            <GrailDisplay
              accent={activeTheme.accent}
              borderStyle={grailCard.borderStyle ?? "Soft"}
              card={grailCard}
              frameStyle="Stand"
              onSelect={() => setSelectedId(grailCard.id)}
            />
          ) : null}

          <div className="mb-3 flex flex-col justify-between gap-3 rounded-lg border border-white/10 bg-[#151b26]/70 p-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/55">
                Gallery
              </p>
              <h3 className="mt-1 text-xl font-black">
                {filteredCards.length} card{filteredCards.length === 1 ? "" : "s"}
              </h3>
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
                  borderStyle={card.borderStyle ?? borderStyle}
                  frameStyle={card.frameStyle ?? frameStyle}
                  mode={displayMode}
                  selected={selectedCard?.id === card.id}
                  onClick={() => setSelectedId(card.id)}
                />
              ))}
            </div>
          )}
        </section>

        <aside className={`h-fit rounded-lg border border-white/10 ${activeTheme.panel} p-3 shadow-xl lg:sticky lg:top-20`}>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/55">
              Card studio
            </p>
            {selectedCard ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black text-slate-300">
                Editing
              </span>
            ) : null}
          </div>
          {selectedCard ? (
            <>
              <div className="mt-4 h-[260px] rounded-xl border border-white/10 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.08),transparent_44%),rgba(0,0,0,0.2)] p-3">
                <CardPreview
                  card={selectedCard}
                  accent={activeTheme.accent}
                  borderStyle={borderStyle}
                  frameStyle={selectedCard.frameStyle ?? frameStyle}
                  large
                />
              </div>
              <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Edit card
                </p>
                <div className="grid gap-2">
                <EditField label="Player">
                  <input
                    value={selectedCard.player}
                    onChange={(event) =>
                      updateCard(selectedCard.id, { player: event.target.value })
                    }
                    className="studio-field"
                  />
                </EditField>
                <div className="grid grid-cols-2 gap-2">
                  <EditField label="Team">
                    <input
                      value={selectedCard.team}
                      onChange={(event) =>
                        updateCard(selectedCard.id, { team: event.target.value })
                      }
                      className="studio-field"
                    />
                  </EditField>
                  <EditField label="Year">
                    <input
                      value={selectedCard.year}
                      onChange={(event) =>
                        updateCard(selectedCard.id, { year: event.target.value })
                      }
                      className="studio-field"
                    />
                  </EditField>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <EditField label="Brand">
                    <input
                      value={selectedCard.brand}
                      onChange={(event) =>
                        updateCard(selectedCard.id, { brand: event.target.value })
                      }
                      className="studio-field"
                    />
                  </EditField>
                  <EditField label="Set">
                    <input
                      value={selectedCard.set}
                      onChange={(event) =>
                        updateCard(selectedCard.id, { set: event.target.value })
                      }
                      className="studio-field"
                    />
                  </EditField>
                </div>
                <EditField label="Collection">
                  <select
                    value={selectedCard.collection}
                    onChange={(event) =>
                      updateCard(selectedCard.id, { collection: event.target.value })
                    }
                    className="studio-field"
                  >
                    {collections
                      .filter((item) => item !== "All")
                      .map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                  </select>
                </EditField>
                <div className="grid grid-cols-2 gap-2">
                  <EditField label="Frame">
                    <select
                      value={selectedCard.frameStyle ?? frameStyle}
                      onChange={(event) =>
                        updateCard(selectedCard.id, {
                          frameStyle: event.target.value as FrameStyle,
                        })
                      }
                      className="studio-field"
                    >
                      <option>Card</option>
                      <option>Gradient</option>
                      <option>Sunset</option>
                      <option>Stand</option>
                    </select>
                  </EditField>
                  <EditField label="Finish">
                    <select
                      value={selectedCard.borderStyle ?? borderStyle}
                      onChange={(event) =>
                        updateCard(selectedCard.id, {
                          borderStyle: event.target.value as BorderStyle,
                        })
                      }
                      className="studio-field"
                    >
                      <option>Soft</option>
                      <option>Chrome</option>
                      <option>Glow</option>
                    </select>
                  </EditField>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <EditField label="Frame color">
                    <input
                      value={selectedCard.color}
                      onChange={(event) =>
                        updateCard(selectedCard.id, { color: event.target.value })
                      }
                      className="studio-field"
                      type="color"
                    />
                  </EditField>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <EditField label="Status">
                    <select
                      value={selectedCard.status}
                      onChange={(event) =>
                        updateCard(selectedCard.id, {
                          status: event.target.value as Card["status"],
                        })
                      }
                      className="studio-field"
                    >
                      <option>Vaulted</option>
                      <option>Wishlist</option>
                      <option>For Trade</option>
                    </select>
                  </EditField>
                </div>
                <button
                  onClick={() => setGrailId(selectedCard.id)}
                  className="h-9 rounded-md border border-white/10 bg-white/5 text-xs font-black text-slate-200 hover:bg-white/10"
                >
                  Set as grail display
                </button>
              </div>
              </div>
              {showMoney ? (
                <div className="mt-3 grid grid-cols-3 gap-2">
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
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Detail label="Status" value={selectedCard.status} />
                  <Detail label="Sale" value={selectedCard.saleStatus ?? "Holding"} />
                </div>
              )}
              <button
                onClick={() => deleteCard(selectedCard.id)}
                className="mt-4 h-10 w-full rounded-md border border-red-400/20 bg-red-500/10 text-sm font-bold text-red-200 hover:bg-red-500/20"
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
    </main>
  );
}

function displayModeClasses(mode: DisplayMode) {
  if (mode === "Compact") {
    return "grid gap-3";
  }

  if (mode === "Showcase") {
    return "grid auto-rows-fr gap-5 xl:grid-cols-2";
  }

  return "grid auto-rows-fr gap-4 [grid-template-columns:repeat(auto-fill,minmax(210px,1fr))]";
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

function StyleSwatch({
  active,
  dark = false,
  glass = false,
  label,
  rainbow = false,
}: {
  active: boolean;
  dark?: boolean;
  glass?: boolean;
  label: string;
  rainbow?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-2 ${
        active ? "border-white/60" : "border-white/10"
      } ${dark ? "bg-black" : "bg-white/10"}`}
    >
      <div
        className={`h-12 rounded ${
          rainbow
            ? "bg-[linear-gradient(135deg,#ff4d1c,#f8e71c,#21c55d,#38bdf8,#8b5cf6)]"
            : glass
              ? "border border-white/30 bg-white/20"
            : dark
              ? "bg-[#111]"
              : "bg-slate-100"
        }`}
      />
      <p className={`mt-2 text-center text-[10px] font-black ${dark ? "text-yellow-200" : "text-white"}`}>
        {label}
      </p>
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
      className="mb-4 grid w-full gap-5 overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.09),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.01))] p-4 text-left shadow-2xl transition hover:border-white/20 lg:grid-cols-[230px_minmax(0,1fr)]"
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
      <div className="self-center rounded-xl border border-white/10 bg-black/20 p-5">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
          Grail display
        </p>
        <h3 className="mt-3 text-2xl font-black leading-tight text-white">
          {card.player}
        </h3>
        <p className="mt-1 text-sm text-slate-400">{card.team}</p>
        <p className="mt-5 max-w-xl text-sm font-bold leading-6 text-slate-200">
          {card.year} {card.brand} {card.set}
        </p>
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
    <div className="mt-3 space-y-1.5 first:mt-0">
      <p className="text-xs font-bold text-slate-100">{title}</p>
      {children}
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
              {card.year} {card.brand} {card.set} | {card.grade}
            </p>
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`group h-full rounded-xl bg-[#151b26] p-3 text-left transition hover:-translate-y-0.5 ${
        selected ? "border-white/60" : "border-white/10"
      } ${tileBorderClass(borderStyle)} ${
        mode === "Showcase"
          ? "grid items-center gap-6 sm:grid-cols-[210px_minmax(0,1fr)]"
          : "flex flex-col"
      }`}
    >
      <div className={mode === "Showcase" ? "h-[280px]" : "h-[214px]"}>
        <CardPreview
          card={card}
          accent={accent}
          borderStyle={borderStyle}
          frameStyle={readFrameStyle(card.frameStyle ?? frameStyle)}
          large={mode === "Showcase"}
        />
      </div>
      <div
        className={
          mode === "Showcase"
            ? "min-w-0 rounded-xl border border-white/10 bg-black/20 p-4"
            : "mt-3 flex flex-1 flex-col"
        }
      >
        <div className="min-w-0">
          <p className="text-[15px] font-black leading-tight text-white">
            {card.player}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{card.team}</p>
        </div>
        <p className="mt-3 text-xs font-bold leading-5 text-slate-200">
          {card.year} {card.brand} {card.set}
        </p>
        {card.grade && card.grade !== "Raw" ? (
          <p className="mt-1 text-xs text-slate-500">{card.grade}</p>
        ) : null}
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
    <div
      className={`flex h-full items-center justify-center overflow-visible rounded-lg bg-black/20 p-2.5 ${previewBorderClass(borderStyle)}`}
      style={previewBorderStyle(borderStyle, card.color || accent)}
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
                <Image
                  src={card.imageUrl}
                  alt={cardTitle || "Card image"}
                  fill
                  unoptimized
                  sizes={large ? "280px" : "220px"}
                  className="object-cover"
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

function tileBorderClass(borderStyle: BorderStyle) {
  if (borderStyle === "Chrome") {
    return "border border-cyan-100/30 bg-[linear-gradient(145deg,rgba(255,255,255,0.10),rgba(56,189,248,0.07),rgba(255,255,255,0.03))] shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(0,0,0,0.5),0_18px_42px_rgba(0,0,0,0.35)]";
  }

  if (borderStyle === "Glow") {
    return "border border-white/15 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.11),transparent_42%),linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.015))] shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_18px_42px_rgba(0,0,0,0.38)]";
  }

  return "border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.06),rgba(15,23,42,0.92))] shadow-[0_18px_38px_rgba(0,0,0,0.32)]";
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
    return "rounded-2xl p-2 shadow-2xl";
  }

  if (frameStyle === "Sunset") {
    return "rounded-2xl p-2 shadow-2xl";
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
    return "border border-black/35";
  }

  if (frameStyle === "Stand") {
    return "border border-white/25";
  }

  return "border border-black/20";
}

function imageWindowClass(frameStyle: FrameStyle) {
  if (frameStyle === "Gradient" || frameStyle === "Sunset") {
    return "bg-black/10";
  }

  if (frameStyle === "Stand") {
    return "bg-white/5";
  }

  return "bg-[#0d111a]";
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
