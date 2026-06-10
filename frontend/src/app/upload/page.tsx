"use client";

import Link from "next/link";
import { useState } from "react";

type CardStatus = "Vaulted" | "Wishlist" | "For Trade";
type CardTag = "Rookie" | "Auto" | "Patch" | "Numbered" | "Favorite";

type CardDraft = {
  id: string;
  fileName: string;
  imageUrl: string;
  sourceUrl?: string;
  sourceName?: string;
  player: string;
  sport: string;
  team: string;
  year: string;
  brand: string;
  set: string;
  status: CardStatus;
  grade: string;
  color: string;
  collection: string;
  estimatedValue: string;
  purchasePrice: string;
  salePrice: string;
  saleStatus: "Holding" | "Listed" | "Sold";
  frameStyle: "Card" | "Gradient" | "Sunset" | "Stand";
  borderStyle: "Soft" | "Chrome" | "Glow";
  tags: CardTag[];
  imageX: number;
  imageY: number;
  imageZoom: number;
  imageRotation: number;
};

const sports = ["Basketball", "Baseball", "Football", "Hockey", "Soccer"];
const brands = ["Topps", "Panini", "Upper Deck", "Bowman", "Fleer", "Donruss"];
const grades = ["Raw", "PSA 10", "PSA 9", "BGS 9.5", "BGS 9", "SGC 10", "SGC 9.5"];
const statuses: CardStatus[] = ["Vaulted", "Wishlist", "For Trade"];
const saleStatuses = ["Holding", "Listed", "Sold"] as const;
const frameStyles = ["Card", "Gradient", "Sunset", "Stand"] as const;
const borderStyles = ["Soft", "Chrome", "Glow"] as const;
const cardTags: CardTag[] = ["Rookie", "Auto", "Patch", "Numbered", "Favorite"];
const colors = ["#ff4d1c", "#38bdf8", "#f59e0b", "#21c55d", "#8b5cf6", "#ef3f6b"];

export default function UploadPage() {
  const [drafts, setDrafts] = useState<CardDraft[]>([]);
  const [savedMessage, setSavedMessage] = useState("");
  const [ebayUrl, setEbayUrl] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showMoney] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("cardroster.showMoney") !== "false";
  });
  const [batchSport, setBatchSport] = useState("Basketball");
  const [batchBrand, setBatchBrand] = useState("Topps");
  const [batchCollection, setBatchCollection] = useState("Main Collection");
  const [batchGrade, setBatchGrade] = useState("Raw");
  const [batchFrame, setBatchFrame] =
    useState<(typeof frameStyles)[number]>("Card");
  const [batchBorder, setBatchBorder] = useState<"Soft" | "Chrome" | "Glow">(
    "Soft",
  );
  const [collections, setCollections] = useState<string[]>(() => {
    if (typeof window === "undefined") return ["Main Collection"];
    return JSON.parse(
      localStorage.getItem("cardroster.collections") ?? "[\"Main Collection\"]",
    );
  });
  const [savedCards] = useState<
    Array<{
      player?: string;
      team?: string;
      year?: string;
      brand?: string;
      set?: string;
      sourceUrl?: string;
    }>
  >(() => {
    if (typeof window === "undefined") return [];
    return JSON.parse(localStorage.getItem("cardroster.cards") ?? "[]");
  });
  const [newCollection, setNewCollection] = useState("");
  const playerSuggestions = uniqueValues(savedCards.map((card) => card.player));
  const teamSuggestions = uniqueValues(savedCards.map((card) => card.team));
  const setSuggestions = uniqueValues(savedCards.map((card) => card.set));

  async function handleFiles(files: FileList | null) {
    if (!files) return;

    const nextDrafts: CardDraft[] = await Promise.all(
      Array.from(files).map(async (file, index) => {
        const imageUrl = await optimizeImageFile(file);

        return {
          id: crypto.randomUUID(),
          fileName: file.name,
          imageUrl,
          sourceName: "Image upload",
          player: nameFromFile(file.name),
          sport: sportFromFile(file.name) || batchSport,
          team: "",
          year: yearFromFile(file.name),
          brand: brandFromFile(file.name) || batchBrand,
          set: "",
          status: "Vaulted" as CardStatus,
          grade: batchGrade,
          color: colors[index % colors.length],
          collection: batchCollection || collections[0] || "Main Collection",
          estimatedValue: "",
          purchasePrice: "",
          salePrice: "",
          saleStatus: "Holding" as const,
          frameStyle: batchFrame,
          borderStyle: batchBorder,
          tags: tagGuesses(file.name),
          imageX: 50,
          imageY: 50,
          imageZoom: 100,
          imageRotation: 0,
        };
      }),
    );

    setDrafts((currentDrafts) => [...currentDrafts, ...nextDrafts]);
    setSavedMessage("");
  }

  async function importEbayListing() {
    const cleanUrl = ebayUrl.trim();
    if (!cleanUrl || isImporting) return;

    setIsImporting(true);
    setImportMessage("");
    setSavedMessage("");

    try {
      const response = await fetch(`/api/ebay/import?url=${encodeURIComponent(cleanUrl)}`);
      const listing = await response.json();

      if (!response.ok) {
        throw new Error(listing.error ?? "Unable to import that eBay listing.");
      }

      if (!listing.imageUrl) {
        throw new Error("That eBay listing did not return a card image.");
      }

      const title = listing.title ?? "";
      const nextDraft: CardDraft = {
        id: crypto.randomUUID(),
        fileName: title || "eBay listing",
        imageUrl: listing.imageUrl,
        sourceUrl: listing.itemWebUrl ?? cleanUrl,
        sourceName: "eBay",
        player: playerFromTitle(title),
        sport: sportFromTitle(title) || batchSport,
        team: teamFromTitle(title),
        year: yearFromFile(title),
        brand: brandFromFile(title) || listing.brand || batchBrand,
        set: setFromTitle(title),
        status: "Vaulted",
        grade: gradeFromTitle(title),
        color: colors[drafts.length % colors.length],
        collection: batchCollection || collections[0] || "Main Collection",
        estimatedValue: showMoney ? (listing.price ?? "") : "",
        purchasePrice: showMoney ? (listing.price ?? "") : "",
        salePrice: "",
        saleStatus: "Holding",
        frameStyle: batchFrame,
        borderStyle: batchBorder,
        tags: tagGuesses(title),
        imageX: 50,
        imageY: 50,
        imageZoom: 100,
        imageRotation: 0,
      };

      setDrafts((currentDrafts) => [nextDraft, ...currentDrafts]);
      setEbayUrl("");
      setImportMessage("Listing imported. Review the draft before saving.");
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "Unable to import that listing.");
    } finally {
      setIsImporting(false);
    }
  }

  function updateDraft(
    id: string,
    field: keyof CardDraft,
    value: CardDraft[keyof CardDraft],
  ) {
    setDrafts((currentDrafts) =>
      currentDrafts.map((draft) =>
        draft.id === id ? { ...draft, [field]: value } : draft,
      ),
    );
  }

  function removeDraft(id: string) {
    setDrafts((currentDrafts) => currentDrafts.filter((draft) => draft.id !== id));
  }

  function addCollection() {
    const cleanName = newCollection.trim();
    if (!cleanName || collections.includes(cleanName)) return;

    const nextCollections = [...collections, cleanName];
    setCollections(nextCollections);
    localStorage.setItem("cardroster.collections", JSON.stringify(nextCollections));
    setNewCollection("");
  }

  async function saveDrafts() {
    if (isSaving || drafts.length === 0) return;

    setIsSaving(true);
    setSavedMessage("");

    try {
      const savedCards = JSON.parse(localStorage.getItem("cardroster.cards") ?? "[]");
      const compactSavedCards = await Promise.all(
        savedCards.map(async (card: Record<string, unknown>) => ({
          ...card,
          imageUrl:
            typeof card.imageUrl === "string"
              ? await optimizeStoredImage(card.imageUrl)
              : card.imageUrl,
        })),
      );
    const nextCollections = Array.from(
      new Set([...collections, ...drafts.map((draft) => draft.collection)]),
    );
    const compactDrafts = await Promise.all(
      drafts.map(async (draft) => ({
        ...draft,
        imageUrl: await optimizeStoredImage(draft.imageUrl),
      })),
    );
    const nextCards = compactDrafts.map((draft) => ({
      id: draft.id,
      player: draft.player || "Unnamed Card",
      sport: draft.sport,
      team: draft.team || "Unknown Team",
      year: draft.year || "Unknown Year",
      brand: draft.brand,
      set: draft.set || "Base Set",
      status: draft.status,
      grade: draft.grade,
      color: draft.color,
      collection: draft.collection || "Main Collection",
      estimatedValue: draft.estimatedValue,
      purchasePrice: draft.purchasePrice,
      salePrice: draft.salePrice,
      saleStatus: draft.saleStatus,
      frameStyle: draft.frameStyle,
      borderStyle: draft.borderStyle,
      imageUrl: draft.imageUrl,
      sourceUrl: draft.sourceUrl,
      sourceName: draft.sourceName,
      tags: draft.tags,
      imageX: draft.imageX,
      imageY: draft.imageY,
      imageZoom: draft.imageZoom,
      imageRotation: draft.imageRotation,
    }));

    localStorage.setItem(
      "cardroster.cards",
      JSON.stringify([...nextCards, ...compactSavedCards]),
    );
    localStorage.setItem("cardroster.collections", JSON.stringify(nextCollections));
    setCollections(nextCollections);
    setDrafts([]);
    setSavedMessage(`${nextCards.length} card${nextCards.length === 1 ? "" : "s"} saved to gallery.`);
    } catch (error) {
      const isQuotaError =
        error instanceof DOMException &&
        (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED");

      setSavedMessage(
        isQuotaError
          ? "Browser storage is full. Remove a few older local cards or wait for database image storage before saving more large uploads."
          : error instanceof Error
            ? error.message
            : "Unable to save cards.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0f1218] px-4 py-5 text-white sm:px-6">
      <div className="mx-auto max-w-[1440px]">
        <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#0f1218]/90 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
          <Link
            href="/"
            className="inline-flex h-9 items-center rounded-md border border-white/10 bg-white/5 px-3 text-xs font-bold text-slate-200 hover:bg-white/10"
          >
            Back to gallery
          </Link>

          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
            Upload Studio
          </p>
        </div>

        <section className="relative mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.10),transparent_30%),radial-gradient(circle_at_82%_0%,rgba(56,189,248,0.12),transparent_28%),linear-gradient(135deg,rgba(21,27,38,0.96),rgba(10,14,20,0.96))] p-4 shadow-2xl">
          <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#ff4d1c,#f8e71c,#20e3b2,#38bdf8,#ec4899)]" />
          <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#ffb84d]">
                CardRoster import
              </p>
              <h1 className="mt-1 max-w-3xl text-3xl font-black leading-tight tracking-normal sm:text-4xl">
                Drop, detect, crop, and save.
              </h1>
              <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-slate-300">
                Upload card photos now, then use eBay listing import once your developer access is ready.
              </p>
              <div className="mt-5 grid max-w-2xl gap-2 sm:grid-cols-3">
                <UploadStat label="Drafts" value={drafts.length.toString()} />
                <UploadStat label="Autofill" value="On" />
                <UploadStat label="Ready" value={drafts.length.toString()} />
              </div>
            </div>

            <div className="grid gap-3">
              <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/20 bg-black/25 px-5 py-8 text-center transition hover:-translate-y-0.5 hover:border-white/35 hover:bg-white/5">
                <span className="grid size-12 place-items-center rounded-2xl border border-white/10 bg-white/5 text-lg font-black text-white">
                  +
                </span>
                <span className="mt-3 text-base font-black">Drop card images</span>
                <span className="mt-1 text-xs text-slate-400">
                  Previewed in the same card frame used in your gallery
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => handleFiles(event.target.files)}
                />
              </label>

              <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  eBay listing import
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    value={ebayUrl}
                    onChange={(event) => setEbayUrl(event.target.value)}
                    className="field"
                    placeholder="Paste listing link"
                  />
                  <button
                    onClick={importEbayListing}
                    disabled={!ebayUrl.trim() || isImporting}
                    className="h-9 rounded-md bg-white px-4 text-xs font-black text-[#111722] transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-500"
                  >
                    {isImporting ? "Importing" : "Import"}
                  </button>
                </div>
                {importMessage ? (
                  <p className="mt-2 text-xs font-bold text-slate-300">
                    {importMessage}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {savedMessage ? (
            <div className="lg:col-span-2 rounded-lg border border-[#21c55d]/30 bg-[#21c55d]/10 p-3 text-sm font-bold text-[#86efac]">
              {savedMessage}
            </div>
          ) : null}
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="rounded-xl border border-white/10 bg-[#151b26] p-3 shadow-xl">
            <details>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Fast fill
                  </p>
                  <p className="mt-1 text-sm font-black text-white">
                    Defaults for new uploads
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black text-slate-300">
                  Optional
                </span>
              </summary>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <select
              value={batchCollection}
              onChange={(event) => setBatchCollection(event.target.value)}
              className="field"
            >
              {collections.map((collection) => (
                <option key={collection}>{collection}</option>
              ))}
            </select>
            <select
              value={batchSport}
              onChange={(event) => setBatchSport(event.target.value)}
              className="field"
            >
              {sports.map((sport) => (
                <option key={sport}>{sport}</option>
              ))}
            </select>
            <select
              value={batchBrand}
              onChange={(event) => setBatchBrand(event.target.value)}
              className="field"
            >
              {brands.map((brand) => (
                <option key={brand}>{brand}</option>
              ))}
            </select>
            <select
              value={batchGrade}
              onChange={(event) => setBatchGrade(event.target.value)}
              className="field"
            >
              {grades.map((grade) => (
                <option key={grade}>{grade}</option>
              ))}
            </select>
            <select
              value={batchFrame}
              onChange={(event) =>
                setBatchFrame(event.target.value as (typeof frameStyles)[number])
              }
              className="field"
            >
              {frameStyles.map((frameStyle) => (
                <option key={frameStyle}>{frameStyle}</option>
              ))}
            </select>
            <select
              value={batchBorder}
              onChange={(event) =>
                setBatchBorder(event.target.value as "Soft" | "Chrome" | "Glow")
              }
              className="field"
            >
              {borderStyles.map((borderStyle) => (
                <option key={borderStyle}>{borderStyle}</option>
              ))}
            </select>
              </div>
            </details>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#151b26] p-3 shadow-xl">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              Collections
            </p>
            <div className="mt-3 grid gap-2">
              <input
                value={newCollection}
                onChange={(event) => setNewCollection(event.target.value)}
                className="field"
                placeholder="New collection name"
              />
              <button
                onClick={addCollection}
                className="h-9 rounded-md border border-white/10 bg-white/5 px-4 text-xs font-bold text-slate-200 hover:bg-white/10"
              >
                Add collection
              </button>
            </div>
          </div>
        </section>

        <section className="mt-5">
          <datalist id="player-suggestions">
            {playerSuggestions.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
          <datalist id="team-suggestions">
            {teamSuggestions.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
          <datalist id="set-suggestions">
            {setSuggestions.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#ffb84d]">
                Step 2
              </p>
              <h2 className="text-xl font-black">Review drafts</h2>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-xs font-bold text-slate-400">
                {drafts.length} ready
              </p>
              <button
                onClick={saveDrafts}
                disabled={drafts.length === 0 || isSaving}
                className="h-9 rounded-md bg-[#ff4d1c] px-4 text-xs font-black text-white transition hover:bg-[#ff6a3d] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-500"
              >
                {isSaving ? "Saving" : "Save drafts"}
              </button>
            </div>
          </div>

          {drafts.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-[linear-gradient(135deg,rgba(21,27,38,0.9),rgba(10,14,20,0.95))] p-8 text-center text-sm text-slate-400">
              Drop images or import an eBay listing to start.
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {drafts.map((draft) => (
                <article
                  key={draft.id}
                  className="grid gap-4 rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(21,27,38,0.98),rgba(11,15,22,0.98))] p-3 shadow-2xl sm:grid-cols-[190px_1fr]"
                >
                  <div>
                    <div className="h-[280px] rounded-xl border border-white/10 bg-black/25 p-3 shadow-2xl">
                      <UploadCardPreview draft={draft} />
                    </div>
                    <div className="mt-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5">
                      <p className="truncate text-[11px] font-black text-slate-300">
                        {draft.sourceName ?? "Image upload"}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] font-bold text-slate-500">
                        {draft.fileName}
                      </p>
                    </div>
                  </div>

                  <div>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                          Review card
                        </p>
                        <p className="mt-0.5 text-sm font-black text-white">
                          {draft.player || "Needs player"}
                        </p>
                        {duplicateWarning(draft, savedCards, drafts) ? (
                          <p className="mt-1 rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-[10px] font-black text-amber-100">
                            Possible duplicate
                          </p>
                        ) : null}
                      </div>
                      <button
                        onClick={() => removeDraft(draft.id)}
                        className="h-8 rounded-md border border-white/10 bg-white/5 px-3 text-xs font-bold text-slate-200 hover:bg-white/10"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Field label="Player">
                        <input
                          value={draft.player}
                          onChange={(event) =>
                            updateDraft(draft.id, "player", event.target.value)
                          }
                          className="field"
                          list="player-suggestions"
                        />
                      </Field>

                      <Field label="Collection">
                        <select
                          value={draft.collection}
                          onChange={(event) =>
                            updateDraft(draft.id, "collection", event.target.value)
                          }
                          className="field"
                        >
                          {collections.map((collection) => (
                            <option key={collection}>{collection}</option>
                          ))}
                        </select>
                      </Field>

                      <Field label="Team">
                        <input
                          value={draft.team}
                          onChange={(event) =>
                            updateDraft(draft.id, "team", event.target.value)
                          }
                          placeholder="Team name"
                          className="field"
                          list="team-suggestions"
                        />
                      </Field>

                      <Field label="Sport">
                        <select
                          value={draft.sport}
                          onChange={(event) =>
                            updateDraft(draft.id, "sport", event.target.value)
                          }
                          className="field"
                        >
                          {sports.map((sport) => (
                            <option key={sport}>{sport}</option>
                          ))}
                        </select>
                      </Field>

                      <Field label="Year">
                        <input
                          value={draft.year}
                          onChange={(event) =>
                            updateDraft(draft.id, "year", event.target.value)
                          }
                          placeholder="Year"
                          className="field"
                        />
                      </Field>

                      <Field label="Brand">
                        <select
                          value={draft.brand}
                          onChange={(event) =>
                            updateDraft(draft.id, "brand", event.target.value)
                          }
                          className="field"
                        >
                          {brands.map((brand) => (
                            <option key={brand}>{brand}</option>
                          ))}
                        </select>
                      </Field>

                      <Field label="Set">
                        <input
                          value={draft.set}
                          onChange={(event) =>
                            updateDraft(draft.id, "set", event.target.value)
                          }
                          placeholder="Base Set, Rookie, Prizm..."
                          className="field"
                          list="set-suggestions"
                        />
                      </Field>

                      <Field label="Grade">
                        <select
                          value={draft.grade}
                          onChange={(event) =>
                            updateDraft(draft.id, "grade", event.target.value)
                          }
                          className="field"
                        >
                          {grades.map((grade) => (
                            <option key={grade}>{grade}</option>
                          ))}
                        </select>
                      </Field>

                      <Field label="Frame">
                        <select
                          value={draft.frameStyle}
                          onChange={(event) =>
                            updateDraft(draft.id, "frameStyle", event.target.value)
                          }
                          className="field"
                        >
                          {frameStyles.map((frameStyle) => (
                            <option key={frameStyle}>{frameStyle}</option>
                          ))}
                        </select>
                      </Field>

                      <Field label="Finish">
                        <select
                          value={draft.borderStyle}
                          onChange={(event) =>
                            updateDraft(draft.id, "borderStyle", event.target.value)
                          }
                          className="field"
                        >
                          {borderStyles.map((borderStyle) => (
                            <option key={borderStyle}>{borderStyle}</option>
                          ))}
                        </select>
                      </Field>

                      <Field label="Status">
                        <select
                          value={draft.status}
                          onChange={(event) =>
                            updateDraft(draft.id, "status", event.target.value)
                          }
                          className="field"
                        >
                          {statuses.map((status) => (
                            <option key={status}>{status}</option>
                          ))}
                        </select>
                      </Field>

                      <Field label="Tags">
                        <div className="flex flex-wrap gap-2">
                          {cardTags.map((tag) => {
                            const active = draft.tags.includes(tag);

                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() =>
                                  updateDraft(draft.id, "tags", toggleDraftTag(draft.tags, tag))
                                }
                                className={`h-8 rounded-full px-3 text-[11px] font-black transition ${
                                  active
                                    ? "bg-white text-[#111722]"
                                    : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                                }`}
                              >
                                {tag}
                              </button>
                            );
                          })}
                        </div>
                      </Field>

                      <div className="rounded-lg border border-white/10 bg-black/20 p-3 sm:col-span-2">
                        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                          Crop position
                        </p>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <RangeField
                            label="Horizontal"
                            value={draft.imageX}
                            onChange={(value) => updateDraft(draft.id, "imageX", value)}
                          />
                          <RangeField
                            label="Vertical"
                            value={draft.imageY}
                            onChange={(value) => updateDraft(draft.id, "imageY", value)}
                          />
                          <RangeField
                            label="Zoom"
                            min={100}
                            max={150}
                            value={draft.imageZoom}
                            onChange={(value) => updateDraft(draft.id, "imageZoom", value)}
                          />
                          <RangeField
                            label="Rotate"
                            min={-180}
                            max={180}
                            value={draft.imageRotation}
                            onChange={(value) => updateDraft(draft.id, "imageRotation", value)}
                          />
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          <button type="button" onClick={() => updateDraft(draft.id, "imageRotation", rotateValue(draft.imageRotation, -90))} className="h-8 rounded-md border border-white/10 bg-white/5 text-xs font-black text-slate-200 hover:bg-white/10">
                            Left
                          </button>
                          <button type="button" onClick={() => updateDraft(draft.id, "imageRotation", rotateValue(draft.imageRotation, 90))} className="h-8 rounded-md border border-white/10 bg-white/5 text-xs font-black text-slate-200 hover:bg-white/10">
                            Right
                          </button>
                          <button type="button" onClick={() => {
                            updateDraft(draft.id, "imageX", 50);
                            updateDraft(draft.id, "imageY", 50);
                            updateDraft(draft.id, "imageZoom", 100);
                            updateDraft(draft.id, "imageRotation", 0);
                          }} className="h-8 rounded-md border border-white/10 bg-white/5 text-xs font-black text-slate-200 hover:bg-white/10">
                            Reset
                          </button>
                        </div>
                      </div>

                      {showMoney ? (
                        <>
                          <Field label="Value">
                            <input
                              value={draft.estimatedValue}
                              onChange={(event) =>
                                updateDraft(
                                  draft.id,
                                  "estimatedValue",
                                  event.target.value,
                                )
                              }
                              placeholder="Estimated value"
                              className="field"
                            />
                          </Field>

                          <Field label="Cost">
                            <input
                              value={draft.purchasePrice}
                              onChange={(event) =>
                                updateDraft(
                                  draft.id,
                                  "purchasePrice",
                                  event.target.value,
                                )
                              }
                              placeholder="Purchase price"
                              className="field"
                            />
                          </Field>

                          <Field label="Sale">
                            <select
                              value={draft.saleStatus}
                              onChange={(event) =>
                                updateDraft(draft.id, "saleStatus", event.target.value)
                              }
                              className="field"
                            >
                              {saleStatuses.map((saleStatus) => (
                                <option key={saleStatus}>{saleStatus}</option>
                              ))}
                            </select>
                          </Field>

                          <Field label="Sold for">
                            <input
                              value={draft.salePrice}
                              onChange={(event) =>
                                updateDraft(draft.id, "salePrice", event.target.value)
                              }
                              placeholder="Sale price"
                              className="field"
                            />
                          </Field>
                        </>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function UploadCardPreview({ draft }: { draft: CardDraft }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div
        className={`aspect-[5/7] h-full max-h-full rounded-2xl p-2.5 shadow-[0_18px_42px_rgba(0,0,0,0.42)] ${
          draft.frameStyle === "Gradient"
            ? "bg-[linear-gradient(135deg,#ff8a3d,#f8e71c,#20e3b2,#38bdf8,#ec4899)]"
            : draft.frameStyle === "Sunset"
              ? "bg-[linear-gradient(135deg,#ff8a3d,#f8e71c,#20e3b2,#38bdf8)]"
              : draft.frameStyle === "Stand"
                ? "border border-white/25 bg-white/10"
                : "border border-white/15 bg-[#1b2330]"
        }`}
        style={draft.frameStyle === "Card" ? { borderColor: draft.color } : undefined}
      >
        <div
          className={`h-full overflow-hidden rounded-xl bg-[#0d121b] ${
            draft.borderStyle === "Glow"
              ? "ring-2 ring-white/30"
              : draft.borderStyle === "Chrome"
                ? "ring-2 ring-slate-300/40"
                : "ring-1 ring-black/50"
          }`}
          style={{
            boxShadow:
              draft.borderStyle === "Glow"
                ? `0 0 28px ${draft.color}66`
                : undefined,
          }}
        >
          <div
            className="h-full bg-cover bg-center"
            style={{
              backgroundImage: `url(${draft.imageUrl})`,
              backgroundPosition: `${draft.imageX}% ${draft.imageY}%`,
              backgroundSize: `${draft.imageZoom}%`,
              transform: `rotate(${draft.imageRotation}deg)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function Field({
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

function UploadStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/25 p-3">
      <p className="truncate text-lg font-black text-white">{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
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

function toggleDraftTag(tags: CardTag[], tag: CardTag) {
  return tags.includes(tag)
    ? tags.filter((item) => item !== tag)
    : [...tags, tag];
}

function rotateValue(current: number, change: number) {
  const next = ((current + change) % 360 + 360) % 360;
  return next > 180 ? next - 360 : next;
}

function tagGuesses(value: string) {
  const lower = value.toLowerCase();
  const tags: CardTag[] = [];

  if (/\b(rookie| rc )\b/.test(lower)) tags.push("Rookie");
  if (/\b(auto|autograph)\b/.test(lower)) tags.push("Auto");
  if (/\b(patch|relic|jersey)\b/.test(lower)) tags.push("Patch");
  if (/#\d+|\bnumbered\b|\b\/\d+\b/.test(lower)) tags.push("Numbered");

  return tags;
}

function uniqueValues(values: Array<string | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]),
  ).slice(0, 80);
}

function duplicateWarning(
  draft: CardDraft,
  savedCards: Array<{
    player?: string;
    year?: string;
    brand?: string;
    set?: string;
    sourceUrl?: string;
  }>,
  drafts: CardDraft[],
) {
  const key = cardIdentity(draft);
  const savedDuplicate = savedCards.some((card) => {
    if (draft.sourceUrl && card.sourceUrl === draft.sourceUrl) return true;
    return cardIdentity(card) === key;
  });
  const draftDuplicate =
    drafts.filter((item) => cardIdentity(item) === key).length > 1;

  return savedDuplicate || draftDuplicate;
}

function cardIdentity(card: {
  player?: string;
  year?: string;
  brand?: string;
  set?: string;
}) {
  return [card.player, card.year, card.brand, card.set]
    .map((value) => value?.trim().toLowerCase() ?? "")
    .join("|");
}

async function optimizeImageFile(file: File) {
  return optimizeStoredImage(await readFile(file));
}

async function optimizeStoredImage(source: string) {
  if (!source.startsWith("data:image/")) return source;
  if (source.length < 450_000) return source;

  const image = await loadImage(source);
  const maxLongSide = 900;
  const scale = Math.min(1, maxLongSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) return source;

  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.78);
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function nameFromFile(fileName: string) {
  const cleanName = fileName
    .replace(/\.[^/.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\d{4}\b/g, "")
    .replace(/\b(topps|panini|upper deck|bowman|fleer|donruss)\b/gi, "")
    .replace(/\b(basketball|baseball|football|hockey|soccer)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleanName
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function playerFromTitle(title: string) {
  const cleanTitle = title
    .replace(/\b(19|20)\d{2}\b/g, "")
    .replace(/\b(topps|panini|upper deck|bowman|fleer|donruss)\b/gi, "")
    .replace(/\b(chrome|prizm|optic|select|mosaic|rookie|rc|auto|autograph|refractor|holo|silver|card|graded|psa|bgs|sgc|gem|mint)\b/gi, "")
    .replace(/\b\d+(\.\d+)?\b/g, "")
    .replace(/[#:/|()[\]-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return titleCase(cleanTitle.split(" ").slice(0, 3).join(" "));
}

function sportFromTitle(title: string) {
  return sportFromFile(title);
}

function teamFromTitle(title: string) {
  const teams = [
    "Raptors",
    "Reds",
    "Steelers",
    "Lakers",
    "Yankees",
    "Maple Leafs",
    "Blue Jays",
    "Dodgers",
    "Celtics",
    "Warriors",
  ];

  return teams.find((team) => title.toLowerCase().includes(team.toLowerCase())) ?? "";
}

function setFromTitle(title: string) {
  const matches = [
    "Chrome",
    "Prizm",
    "Optic",
    "Select",
    "Mosaic",
    "Refractor",
    "Holo",
    "Rookie",
    "Base Set",
  ];

  return matches.filter((match) => title.toLowerCase().includes(match.toLowerCase())).join(" ");
}

function gradeFromTitle(title: string) {
  const grade = title.match(/\b(PSA|BGS|SGC)\s?(10|9\.5|9|8\.5|8)\b/i);
  if (!grade) return "Raw";

  return `${grade[1].toUpperCase()} ${grade[2]}`;
}

function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function yearFromFile(fileName: string) {
  return fileName.match(/\b(19|20)\d{2}\b/)?.[0] ?? "";
}

function sportFromFile(fileName: string) {
  const match = sports.find((sport) =>
    fileName.toLowerCase().includes(sport.toLowerCase()),
  );

  return match ?? "";
}

function brandFromFile(fileName: string) {
  const match = brands.find((brand) =>
    fileName.toLowerCase().includes(brand.toLowerCase()),
  );

  return match ?? "";
}
