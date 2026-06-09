"use client";

import Link from "next/link";
import { useState } from "react";

type CardStatus = "Vaulted" | "Wishlist" | "For Trade";

type CardDraft = {
  id: string;
  fileName: string;
  imageUrl: string;
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
};

const sports = ["Basketball", "Baseball", "Football", "Hockey", "Soccer"];
const brands = ["Topps", "Panini", "Upper Deck", "Bowman", "Fleer", "Donruss"];
const grades = ["Raw", "PSA 10", "PSA 9", "BGS 9.5", "BGS 9", "SGC 10", "SGC 9.5"];
const statuses: CardStatus[] = ["Vaulted", "Wishlist", "For Trade"];
const saleStatuses = ["Holding", "Listed", "Sold"] as const;
const frameStyles = ["Card", "Gradient", "Sunset", "Stand"] as const;
const borderStyles = ["Soft", "Chrome", "Glow"] as const;
const colors = ["#ff4d1c", "#38bdf8", "#f59e0b", "#21c55d", "#8b5cf6", "#ef3f6b"];

export default function UploadPage() {
  const [drafts, setDrafts] = useState<CardDraft[]>([]);
  const [savedMessage, setSavedMessage] = useState("");
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
  const [newCollection, setNewCollection] = useState("");

  async function handleFiles(files: FileList | null) {
    if (!files) return;

    const nextDrafts: CardDraft[] = await Promise.all(
      Array.from(files).map(async (file, index) => {
        const imageUrl = await readFile(file);

        return {
          id: crypto.randomUUID(),
          fileName: file.name,
          imageUrl,
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
        };
      }),
    );

    setDrafts((currentDrafts) => [...currentDrafts, ...nextDrafts]);
    setSavedMessage("");
  }

  function updateDraft(id: string, field: keyof CardDraft, value: string) {
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

  function saveDrafts() {
    const savedCards = JSON.parse(localStorage.getItem("cardroster.cards") ?? "[]");
    const nextCollections = Array.from(
      new Set([...collections, ...drafts.map((draft) => draft.collection)]),
    );
    const nextCards = drafts.map((draft) => ({
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
    }));

    localStorage.setItem(
      "cardroster.cards",
      JSON.stringify([...nextCards, ...savedCards]),
    );
    localStorage.setItem("cardroster.collections", JSON.stringify(nextCollections));
    setCollections(nextCollections);
    setDrafts([]);
    setSavedMessage(`${nextCards.length} card${nextCards.length === 1 ? "" : "s"} saved to gallery.`);
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

        <section className="mt-5 grid gap-4 rounded-lg border border-white/10 bg-[#151b26] p-4 shadow-2xl lg:grid-cols-[1fr_380px]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#ffb84d]">
              Step 1
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-normal">
              Set defaults, then drop images.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Defaults apply to every image you add. Change individual cards in
              the draft list before saving.
            </p>
          </div>

          <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-white/20 bg-black/25 px-5 py-8 text-center transition hover:bg-white/5">
            <span className="text-base font-black">Drop card images here</span>
            <span className="mt-1 text-xs text-slate-400">
              or click to browse your files
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => handleFiles(event.target.files)}
            />
          </label>

          {savedMessage ? (
            <div className="lg:col-span-2 rounded-lg border border-[#21c55d]/30 bg-[#21c55d]/10 p-3 text-sm font-bold text-[#86efac]">
              {savedMessage}
            </div>
          ) : null}
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="rounded-lg border border-white/10 bg-[#151b26] p-3">
            <p className="text-sm font-black text-white">Batch defaults</p>
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
          </div>

          <div className="rounded-lg border border-white/10 bg-[#151b26] p-3">
            <p className="text-sm font-black text-white">Collections</p>
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
                disabled={drafts.length === 0}
                className="h-9 rounded-md bg-[#ff4d1c] px-4 text-xs font-black text-white transition hover:bg-[#ff6a3d] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-500"
              >
                Save drafts
              </button>
            </div>
          </div>

          {drafts.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-[#151b26] p-7 text-center text-sm text-slate-400">
              No drafts yet. Upload card photos to start.
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {drafts.map((draft) => (
                <article
                  key={draft.id}
                  className="grid gap-3 rounded-lg border border-white/10 bg-[#151b26] p-3 shadow-xl sm:grid-cols-[132px_1fr]"
                >
                  <div>
                    <div
                      className="aspect-[5/7] rounded-md bg-black/30 bg-cover bg-center shadow-2xl"
                      style={{ backgroundImage: `url(${draft.imageUrl})` }}
                    />
                    <p className="mt-2 truncate text-[11px] font-bold text-slate-500">
                      {draft.fileName}
                    </p>
                  </div>

                  <div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Field label="Player">
                        <input
                          value={draft.player}
                          onChange={(event) =>
                            updateDraft(draft.id, "player", event.target.value)
                          }
                          className="field"
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
                    </div>

                    <button
                      onClick={() => removeDraft(draft.id)}
                      className="mt-3 h-9 rounded-md border border-white/10 bg-white/5 px-3 text-xs font-bold text-slate-200 hover:bg-white/10"
                    >
                      Remove draft
                    </button>
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
