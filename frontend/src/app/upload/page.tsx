"use client";

import confetti from "canvas-confetti";
import Link from "next/link";
import { useRef, useState } from "react";
import { SoldComps } from "@/components/SoldComps";
import { identifyFromTitle, type IdentifiedCard } from "@/lib/cardIdentifier";
import { compressForStorage } from "@/lib/imageCompressor";

type Step = "Input" | "Review" | "Confirm";
type CardStatus = "Vaulted" | "Wishlist" | "For Trade";
type CardTag = "Rookie" | "Auto" | "Patch" | "Numbered" | "Favorite";
type FieldSource = "ebay_aspects" | "title_parser" | "ocr" | "manual";
type FieldConfidence = {
  confidence: number;
  source: FieldSource;
  value: string;
};
type FrameStyle = "Card" | "Gradient" | "Sunset" | "Stand";
type BorderStyle = "Soft" | "Chrome" | "Glow";

type SavedCard = {
  id: string;
  player: string;
  sport: string;
  team: string;
  year: string;
  brand: string;
  set: string;
  cardNumber?: string;
  parallel?: string;
  status: CardStatus;
  grade: string;
  gradingCompany?: string;
  certNumber?: string;
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
  imageHash?: string;
  confidenceScores?: Record<string, number>;
};

type CardDraft = {
  id: string;
  fileName: string;
  imageUrl: string;
  imageHash?: string;
  sourceUrl?: string;
  sourceName?: string;
  sourcePrice?: string;
  fieldConfidence: Record<string, FieldConfidence>;
  player: string;
  sport: string;
  team: string;
  year: string;
  brand: string;
  set: string;
  cardNumber: string;
  parallel: string;
  status: CardStatus;
  grade: string;
  gradingCompany: string;
  certNumber: string;
  color: string;
  collection: string;
  estimatedValue: string;
  purchasePrice: string;
  salePrice: string;
  saleStatus: "Holding" | "Listed" | "Sold";
  frameStyle: FrameStyle;
  borderStyle: BorderStyle;
  tags: CardTag[];
  imageX: number;
  imageY: number;
  imageZoom: number;
  imageRotation: number;
};

const sports = ["Baseball", "Basketball", "Football", "Hockey", "Soccer", "TCG"];
const brands = [
  "Topps",
  "Topps Chrome",
  "Bowman",
  "Bowman Chrome",
  "Panini",
  "Panini Prizm",
  "Upper Deck",
  "Donruss",
  "Select",
  "Mosaic",
  "Optic",
];
const grades = ["Raw", "PSA 10", "PSA 9", "BGS 9.5", "BGS 9", "SGC 10", "SGC 9.5", "CGC 10"];
const statuses: CardStatus[] = ["Vaulted", "For Trade", "Wishlist"];
const saleStatuses = ["Holding", "Listed", "Sold"] as const;
const frameStyles: FrameStyle[] = ["Card", "Gradient", "Sunset", "Stand"];
const borderStyles: BorderStyle[] = ["Soft", "Chrome", "Glow"];
const cardTags: CardTag[] = ["Rookie", "Auto", "Patch", "Numbered", "Favorite"];
const colors = ["#ff5533", "#38d5ff", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

export default function UploadPage() {
  const ebayInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("Input");
  const [draft, setDraft] = useState<CardDraft | null>(null);
  const [savedCard, setSavedCard] = useState<SavedCard | null>(null);
  const [ebayUrl, setEbayUrl] = useState("");
  const [message, setMessage] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [collections, setCollections] = useState<string[]>(() => {
    if (typeof window === "undefined") return ["Main Collection"];
    return JSON.parse(localStorage.getItem("cardroster.collections") ?? "[\"Main Collection\"]");
  });
  const [existingCards, setExistingCards] = useState<SavedCard[]>(() => {
    if (typeof window === "undefined") return [];
    return JSON.parse(localStorage.getItem("cardroster.cards") ?? "[]");
  });
  const duplicateCard = draft?.imageHash
    ? existingCards.find((card) => card.imageHash && card.imageHash === draft.imageHash)
    : undefined;

  async function createDraftFromFile(file: File) {
    setMessage("");
    const imageUrl = await compressImageFile(file, 1200, 0.85);
    const imageHash = await hashImage(imageUrl);
    const identified = identifyFromTitle(file.name);
    setDraft(draftFromIdentifier({
      fileName: file.name,
      identified,
      imageHash,
      imageUrl,
      sourceName: "Card scan",
    }));
    setStep("Review");
  }

  async function importEbayListing(value = ebayUrl) {
    const cleanUrl = value.trim();
    if (!cleanUrl || isImporting) return;

    setIsImporting(true);
    setMessage("");

    try {
      const response = await fetch(`/api/ebay/import?url=${encodeURIComponent(cleanUrl)}`);
      const listing = await response.json();

      if (!response.ok) {
        throw new Error(listing.error ?? "Unable to import that eBay listing.");
      }

      const fieldConfidence = normalizeFieldConfidence(listing.fieldConfidence);
      const imageHash = listing.imageUrl?.startsWith("data:image/")
        ? await hashImage(listing.imageUrl)
        : undefined;

      setDraft({
        ...emptyDraft(collections),
        id: crypto.randomUUID(),
        fileName: listing.title ?? "eBay listing",
        imageUrl: listing.imageUrl ?? "",
        imageHash,
        sourceUrl: listing.itemWebUrl ?? cleanUrl,
        sourceName: "eBay",
        sourcePrice: listing.price ?? "",
        fieldConfidence,
        player: listing.player ?? "",
        sport: normalizeSport(listing.sport),
        team: listing.team ?? "",
        year: listing.year ?? "",
        brand: listing.brand ?? "Topps",
        set: listing.set ?? "",
        cardNumber: listing.cardNumber ?? "",
        parallel: listing.parallel ?? "",
        grade: listing.grade || "Raw",
        gradingCompany: listing.gradingCompany ?? "",
        certNumber: listing.certNumber ?? "",
        tags: normalizeTags(listing.tags),
      });
      setEbayUrl("");
      setStep("Review");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to import that listing.");
    } finally {
      setIsImporting(false);
    }
  }

  function startManual() {
    setMessage("");
    setDraft(emptyDraft(collections));
    setStep("Review");
  }

  function updateDraft(updates: Partial<CardDraft>) {
    setDraft((current) => {
      if (!current) return current;
      const next = { ...current, ...updates };
      const confidenceUpdates = Object.fromEntries(
        Object.keys(updates)
          .filter((key) => confidenceFieldNames.includes(key))
          .map((key) => [
            key,
            {
              confidence: String(updates[key as keyof CardDraft] ?? "").trim() ? 1 : 0,
              source: "manual" as const,
              value: String(updates[key as keyof CardDraft] ?? ""),
            },
          ]),
      );

      return {
        ...next,
        fieldConfidence: {
          ...current.fieldConfidence,
          ...confidenceUpdates,
        },
      };
    });
  }

  async function saveDraft() {
    if (!draft || isSaving) return;

    setIsSaving(true);
    setMessage("");

    try {
      const savedCards = JSON.parse(localStorage.getItem("cardroster.cards") ?? "[]") as SavedCard[];
      const nextCollections = Array.from(new Set([...collections, draft.collection || "Main Collection"]));
      const storageImageUrl = draft.imageUrl.startsWith("data:image/")
        ? await compressForStorage(draft.imageUrl)
        : draft.imageUrl;
      const card: SavedCard = {
        id: draft.id,
        player: draft.player || "Unnamed Card",
        sport: draft.sport || "Baseball",
        team: draft.team || "Unknown Team",
        year: draft.year || "Unknown Year",
        brand: draft.brand || "Unknown Brand",
        set: draft.set || "Base Set",
        cardNumber: draft.cardNumber,
        parallel: draft.parallel,
        status: draft.status,
        grade: draft.grade || "Raw",
        gradingCompany: draft.gradingCompany,
        certNumber: draft.certNumber,
        color: draft.color,
        collection: draft.collection || "Main Collection",
        estimatedValue: draft.estimatedValue,
        purchasePrice: draft.purchasePrice,
        salePrice: draft.salePrice,
        saleStatus: draft.saleStatus,
        frameStyle: draft.frameStyle,
        borderStyle: draft.borderStyle,
        imageUrl: storageImageUrl,
        sourceUrl: draft.sourceUrl,
        sourceName: draft.sourceName,
        tags: draft.tags,
        imageX: draft.imageX,
        imageY: draft.imageY,
        imageZoom: draft.imageZoom,
        imageRotation: draft.imageRotation,
        imageHash: draft.imageHash,
        confidenceScores: Object.fromEntries(
          Object.entries(draft.fieldConfidence).map(([key, field]) => [key, field.confidence]),
        ),
      };

      localStorage.setItem("cardroster.cards", JSON.stringify([card, ...savedCards]));
      localStorage.setItem("cardroster.collections", JSON.stringify(nextCollections));
      setExistingCards([card, ...savedCards]);
      setCollections(nextCollections);
      setSavedCard(card);
      setStep("Confirm");
      confetti({
        colors: ["#ff5533", "#10b981", "#38d5ff", "#ec4899"],
        particleCount: 90,
        spread: 70,
        origin: { y: 0.7 },
      });
    } catch (error) {
      const isQuotaError =
        error instanceof DOMException &&
        (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED");
      setMessage(
        isQuotaError
          ? "Browser storage is full. Remove older local cards or move to cloud storage before saving more images."
          : error instanceof Error
            ? error.message
            : "Unable to save card.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0b0f16] px-4 py-5 text-white sm:px-6">
      <div className="mx-auto max-w-[1440px]">
        <header className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#0b0f16]/90 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
          <Link
            href="/"
            className="h-10 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-200 hover:bg-white/10"
          >
            Back to gallery
          </Link>
          <StepRail activeStep={step} />
        </header>

        <section className="relative mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[#151b24] p-5 shadow-2xl">
          <div className="absolute inset-x-0 top-0 h-1 bg-[#ff5533] shadow-[0_0_30px_rgba(255,85,51,0.15)]" />
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
            CardRoster intake
          </p>
          <h1 className="mt-2 text-3xl font-black text-white sm:text-5xl">
            Add a card to the vault.
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-slate-300">
            Import, identify, compare recent sales, and save a card that feels
            like a collectible object.
          </p>
        </section>

        {message ? (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm font-bold text-red-100">
            {message}
          </div>
        ) : null}

        {step === "Input" ? (
          <section className="mt-5 grid gap-4 lg:grid-cols-3">
            <InputOption
              body="Take a photo or choose an image. Filename gives CardRoster a first pass."
              icon="CAM"
              title="Point at your card"
            >
              <label className="mt-4 inline-flex h-10 cursor-pointer items-center rounded-lg bg-[#ff5533] px-4 text-sm font-black text-white hover:brightness-110">
                Choose image
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void createDraftFromFile(file);
                  }}
                />
              </label>
            </InputOption>

            <InputOption
              body="Paste a listing and CardRoster fills image, identity, source, and price context."
              icon="eBay"
              title="Paste a listing URL"
              onClick={() => ebayInputRef.current?.focus()}
            >
              <div className="mt-4 grid gap-2">
                <input
                  ref={ebayInputRef}
                  value={ebayUrl}
                  onChange={(event) => setEbayUrl(event.target.value)}
                  onPaste={(event) => {
                    const value = event.clipboardData.getData("text");
                    if (value.includes("ebay.")) {
                      window.setTimeout(() => void importEbayListing(value), 0);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void importEbayListing();
                  }}
                  className="h-10 rounded-lg border border-white/10 bg-[#0d111a] px-3 text-sm font-bold text-white outline-none focus:border-white/30"
                  placeholder="https://www.ebay.com/itm/..."
                />
                <button
                  type="button"
                  onClick={() => void importEbayListing()}
                  disabled={!ebayUrl.trim() || isImporting}
                  className="h-10 rounded-lg bg-[#ff5533] px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isImporting ? "Importing..." : "Import listing"}
                </button>
              </div>
            </InputOption>

            <InputOption
              body="Start with empty fields, then add comps and styling before saving."
              icon="+"
              title="Add card details"
            >
              <button
                type="button"
                onClick={startManual}
                className="mt-4 h-10 rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-black text-slate-200 hover:bg-white/10"
              >
                Manual entry
              </button>
            </InputOption>
          </section>
        ) : null}

        {step === "Review" && draft ? (
          <section className="mt-5 grid gap-5 lg:grid-cols-[420px_minmax(0,1fr)]">
            <aside className="h-fit rounded-xl border border-white/10 bg-[#151b24] p-4 shadow-2xl lg:sticky lg:top-24">
              <CardPreview draft={draft} large />
              <StyleControls draft={draft} onChange={updateDraft} />
              {draft.sourceUrl ? (
                <a
                  href={draft.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-black text-slate-200 hover:bg-white/10"
                >
                  Source listing
                </a>
              ) : null}
            </aside>

            <div className="grid gap-4">
              {duplicateCard ? (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm font-bold leading-6 text-amber-100">
                  This looks like a card you already have: {duplicateCard.player}{" "}
                  {duplicateCard.year} {duplicateCard.brand}. You can save anyway
                  or cancel.
                </div>
              ) : null}

              <FieldGroup title="Identity">
                <Field confidence={draft.fieldConfidence.player} label="Player name">
                  <input
                    value={draft.player}
                    onChange={(event) => updateDraft({ player: event.target.value })}
                    className="field-large"
                    placeholder="Player name"
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field confidence={draft.fieldConfidence.year} label="Year">
                    <input value={draft.year} onChange={(event) => updateDraft({ year: event.target.value })} className="field-dark" />
                  </Field>
                  <Field confidence={draft.fieldConfidence.brand} label="Brand">
                    <input value={draft.brand} onChange={(event) => updateDraft({ brand: event.target.value })} className="field-dark" list="brand-options" />
                  </Field>
                </div>
                <Field confidence={draft.fieldConfidence.set} label="Set">
                  <input value={draft.set} onChange={(event) => updateDraft({ set: event.target.value })} className="field-dark" />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field confidence={draft.fieldConfidence.cardNumber} label="Card number">
                    <input value={draft.cardNumber} onChange={(event) => updateDraft({ cardNumber: event.target.value })} className="field-dark" />
                  </Field>
                  <Field confidence={draft.fieldConfidence.parallel} label="Parallel">
                    <input value={draft.parallel} onChange={(event) => updateDraft({ parallel: event.target.value })} className="field-dark" />
                  </Field>
                </div>
              </FieldGroup>

              <FieldGroup title="Condition">
                <PillRow
                  items={statuses}
                  value={draft.status}
                  onChange={(value) => updateDraft({ status: value as CardStatus })}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field confidence={draft.fieldConfidence.grade} label="Grade">
                    <input value={draft.grade} onChange={(event) => updateDraft({ grade: event.target.value })} className="field-dark" list="grade-options" />
                  </Field>
                  <Field confidence={draft.fieldConfidence.gradingCompany} label="Grading company">
                    <input value={draft.gradingCompany} onChange={(event) => updateDraft({ gradingCompany: event.target.value })} className="field-dark" />
                  </Field>
                </div>
                <Field confidence={draft.fieldConfidence.certNumber} label="Cert number">
                  <input value={draft.certNumber} onChange={(event) => updateDraft({ certNumber: event.target.value })} className="field-dark" />
                </Field>
              </FieldGroup>

              <FieldGroup title="Collection">
                <PillRow
                  items={sports}
                  value={draft.sport}
                  onChange={(value) => updateDraft({ sport: value })}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field confidence={draft.fieldConfidence.team} label="Team">
                    <input value={draft.team} onChange={(event) => updateDraft({ team: event.target.value })} className="field-dark" />
                  </Field>
                  <Field label="Collection">
                    <select value={draft.collection} onChange={(event) => updateDraft({ collection: event.target.value })} className="field-dark">
                      {collections.map((collection) => (
                        <option key={collection}>{collection}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <TagToggles draft={draft} onChange={updateDraft} />
              </FieldGroup>

              <details className="rounded-xl border border-white/10 bg-[#151b24] p-4 shadow-2xl">
                <summary className="cursor-pointer list-none text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                  Value
                </summary>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Field label="Purchase price">
                    <input value={draft.purchasePrice} onChange={(event) => updateDraft({ purchasePrice: event.target.value })} className="field-dark" />
                  </Field>
                  <Field label="Estimated value">
                    <input value={draft.estimatedValue} onChange={(event) => updateDraft({ estimatedValue: event.target.value })} className="field-dark" />
                  </Field>
                  <Field label="Sale status">
                    <select value={draft.saleStatus} onChange={(event) => updateDraft({ saleStatus: event.target.value as CardDraft["saleStatus"] })} className="field-dark">
                      {saleStatuses.map((saleStatus) => (
                        <option key={saleStatus}>{saleStatus}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </details>

              <SoldComps
                card={draft}
                onValueAccepted={(value) => updateDraft({ estimatedValue: formatMoney(value) })}
              />

              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setDraft(null);
                    setStep("Input");
                  }}
                  className="h-10 rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-black text-slate-200 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void saveDraft()}
                  disabled={isSaving}
                  className="h-10 rounded-lg bg-[#ff5533] px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : duplicateCard ? "Save anyway" : "Save card"}
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {step === "Confirm" && savedCard ? (
          <section className="mt-5 grid gap-5 rounded-2xl border border-white/10 bg-[#151b24] p-5 shadow-2xl lg:grid-cols-[360px_minmax(0,1fr)]">
            <CardPreview draft={savedCardToDraft(savedCard, collections)} large />
            <div className="flex flex-col justify-center">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                Saved to vault
              </p>
              <h2 className="mt-2 text-4xl font-black text-white">
                {savedCard.player}
              </h2>
              <p className="mt-3 text-sm font-bold leading-6 text-slate-300">
                {savedCard.year} {savedCard.brand} {savedCard.set}
                {savedCard.cardNumber ? ` #${savedCard.cardNumber}` : ""} was
                added to {savedCard.collection}.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setDraft(null);
                    setSavedCard(null);
                    setStep("Input");
                  }}
                  className="h-10 rounded-lg bg-[#ff5533] px-4 text-sm font-black text-white"
                >
                  Add another
                </button>
                <Link
                  href="/"
                  className="h-10 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-200 hover:bg-white/10"
                >
                  View in collection
                </Link>
              </div>
            </div>
          </section>
        ) : null}

        <datalist id="brand-options">
          {brands.map((brand) => <option key={brand}>{brand}</option>)}
        </datalist>
        <datalist id="grade-options">
          {grades.map((grade) => <option key={grade}>{grade}</option>)}
        </datalist>
      </div>

      <style jsx global>{`
        @keyframes shimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .holo-shimmer {
          background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,85,51,0.3) 25%, rgba(56,213,255,0.3) 50%, rgba(236,72,153,0.3) 75%, rgba(255,255,255,0.15) 100%);
          background-size: 400% 400%;
          animation: shimmer 3s ease infinite;
        }
        .field-dark {
          height: 2.5rem;
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgb(255 255 255 / 0.1);
          background: #0d111a;
          padding: 0 0.75rem;
          font-size: 0.875rem;
          font-weight: 700;
          color: white;
          outline: none;
        }
        .field-dark:focus, .field-large:focus {
          border-color: rgb(255 255 255 / 0.3);
        }
        .field-large {
          height: 3rem;
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgb(255 255 255 / 0.1);
          background: #0d111a;
          padding: 0 0.9rem;
          font-size: 1.125rem;
          font-weight: 900;
          color: white;
          outline: none;
        }
      `}</style>
    </main>
  );
}

function StepRail({ activeStep }: { activeStep: Step }) {
  const steps: Step[] = ["Input", "Review", "Confirm"];
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] p-1">
      {steps.map((step) => (
        <span
          key={step}
          className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${
            activeStep === step ? "bg-white text-[#0d111a]" : "text-slate-500"
          }`}
        >
          {step}
        </span>
      ))}
    </div>
  );
}

function InputOption({
  body,
  children,
  icon,
  onClick,
  title,
}: {
  body: string;
  children: React.ReactNode;
  icon: string;
  onClick?: () => void;
  title: string;
}) {
  return (
    <article
      onClick={onClick}
      className="min-h-80 rounded-2xl border border-white/10 bg-[#151b24] p-5 shadow-2xl transition hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
    >
      <div className="grid size-16 place-items-center rounded-2xl border border-white/10 bg-[#0d111a] text-sm font-black text-[#ff5533] shadow-[0_0_30px_rgba(255,85,51,0.15)]">
        {icon}
      </div>
      <h2 className="mt-5 text-2xl font-black text-white">{title}</h2>
      <p className="mt-3 text-sm font-bold leading-6 text-slate-300">{body}</p>
      {children}
    </article>
  );
}

function FieldGroup({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="rounded-xl border border-white/10 bg-[#151b24] p-4 shadow-2xl">
      <p className="mb-4 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
        {title}
      </p>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function Field({
  children,
  confidence,
  label,
}: {
  children: React.ReactNode;
  confidence?: FieldConfidence;
  label: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex min-h-5 items-center justify-between gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
        <span>{label}</span>
        {confidence ? <ConfidenceBadge confidence={confidence} /> : null}
      </span>
      {children}
    </label>
  );
}

function ConfidenceBadge({ confidence }: { confidence: FieldConfidence }) {
  const label =
    confidence.confidence >= 0.85
      ? "✓"
      : confidence.confidence >= 0.5
        ? "⚠"
        : "✗";
  const className =
    confidence.confidence >= 0.85
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
      : confidence.confidence >= 0.5
        ? "border-amber-500/25 bg-amber-500/10 text-amber-100"
        : "border-red-500/25 bg-red-500/10 text-red-100";

  return (
    <span
      className={`grid size-6 place-items-center rounded-full border text-[10px] font-black ${className}`}
      title={`${Math.round(confidence.confidence * 100)}% from ${confidence.source.replace("_", " ")}`}
    >
      {label}
    </span>
  );
}

function PillRow({
  items,
  onChange,
  value,
}: {
  items: string[];
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onChange(item)}
          className={`h-9 rounded-full px-3 text-xs font-black transition ${
            value === item
              ? "bg-[#ff5533] text-white shadow-[0_0_30px_rgba(255,85,51,0.15)]"
              : "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
          }`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function TagToggles({
  draft,
  onChange,
}: {
  draft: CardDraft;
  onChange: (updates: Partial<CardDraft>) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
        Tags
      </p>
      <div className="flex flex-wrap gap-2">
        {cardTags.map((tag) => {
          const active = draft.tags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => onChange({ tags: toggleTag(draft.tags, tag) })}
              className={`h-9 rounded-full px-3 text-xs font-black transition ${
                active
                  ? "bg-white text-[#0d111a]"
                  : "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StyleControls({
  draft,
  onChange,
}: {
  draft: CardDraft;
  onChange: (updates: Partial<CardDraft>) => void;
}) {
  return (
    <div className="mt-4 grid gap-4">
      <SwatchPicker
        items={frameStyles}
        label="Frame"
        value={draft.frameStyle}
        onChange={(value) => onChange({ frameStyle: value as FrameStyle })}
      />
      <SwatchPicker
        items={borderStyles}
        label="Finish"
        value={draft.borderStyle}
        onChange={(value) => onChange({ borderStyle: value as BorderStyle })}
      />
      <div>
        <p className="mb-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
          Accent
        </p>
        <div className="flex flex-wrap gap-2">
          {colors.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onChange({ color })}
              className={`size-8 rounded-full border ${
                draft.color === color ? "border-white" : "border-white/10"
              }`}
              style={{ backgroundColor: color }}
              aria-label={`Use ${color}`}
            />
          ))}
          <input
            type="color"
            value={draft.color}
            onChange={(event) => onChange({ color: event.target.value })}
            className="size-8 rounded-full border border-white/10 bg-transparent"
            aria-label="Custom accent color"
          />
        </div>
      </div>
    </div>
  );
}

function SwatchPicker({
  items,
  label,
  onChange,
  value,
}: {
  items: string[];
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {items.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            className={`h-10 rounded-xl border px-3 text-xs font-black ${
              value === item
                ? "border-[#ff5533]/60 bg-[#ff5533]/15 text-white"
                : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function CardPreview({ draft, large = false }: { draft: CardDraft; large?: boolean }) {
  const showHolo = draft.tags.includes("Rookie") || draft.tags.includes("Favorite");
  const initials = draft.player
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("") || "CR";

  return (
    <div className={`${large ? "h-[520px]" : "h-[360px]"} rounded-2xl border border-white/10 bg-[#0d111a] p-4 shadow-2xl`}>
      <div className="relative flex h-full items-center justify-center">
        {showHolo ? <div className="holo-shimmer absolute inset-0 rounded-2xl opacity-40" /> : null}
        <div
          className={`relative aspect-[5/7] h-full max-h-full overflow-hidden rounded-2xl border p-2 shadow-2xl ${
            draft.borderStyle === "Glow" ? "border-white/20" : "border-white/10"
          }`}
          style={{
            background:
              draft.frameStyle === "Gradient"
                ? `linear-gradient(135deg, ${draft.color}, #f59e0b, #10b981, #38d5ff)`
                : draft.frameStyle === "Sunset"
                  ? `linear-gradient(135deg, ${draft.color}, #f59e0b, #ec4899)`
                  : "#151b24",
            boxShadow:
              draft.borderStyle === "Glow"
                ? `0 0 30px ${draft.color}55`
                : undefined,
          }}
        >
          <div className="relative h-full overflow-hidden rounded-xl bg-[#0d111a]">
            {draft.imageUrl ? (
              <div
                className="h-full bg-contain bg-center bg-no-repeat"
                style={{
                  backgroundImage: `url(${draft.imageUrl})`,
                  backgroundPosition: `${draft.imageX}% ${draft.imageY}%`,
                  backgroundSize: `${draft.imageZoom}%`,
                  transform: `rotate(${draft.imageRotation}deg)`,
                }}
              />
            ) : (
              <div className="grid h-full place-items-center">
                <div
                  className="grid size-24 place-items-center rounded-full text-3xl font-black text-white"
                  style={{ backgroundColor: draft.color }}
                >
                  {initials}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function emptyDraft(collections: string[]): CardDraft {
  return {
    id: crypto.randomUUID(),
    fileName: "Manual entry",
    imageUrl: "",
    sourceName: "Manual",
    fieldConfidence: {},
    player: "",
    sport: "Baseball",
    team: "",
    year: "",
    brand: "Topps",
    set: "",
    cardNumber: "",
    parallel: "",
    status: "Vaulted",
    grade: "Raw",
    gradingCompany: "",
    certNumber: "",
    color: "#ff5533",
    collection: collections[0] ?? "Main Collection",
    estimatedValue: "",
    purchasePrice: "",
    salePrice: "",
    saleStatus: "Holding",
    frameStyle: "Card",
    borderStyle: "Soft",
    tags: [],
    imageX: 50,
    imageY: 50,
    imageZoom: 100,
    imageRotation: 0,
  };
}

function draftFromIdentifier({
  fileName,
  identified,
  imageHash,
  imageUrl,
  sourceName,
}: {
  fileName: string;
  identified: IdentifiedCard;
  imageHash?: string;
  imageUrl: string;
  sourceName: string;
}): CardDraft {
  const base = emptyDraft(["Main Collection"]);
  const fieldConfidence = confidenceFromIdentifier(identified);
  return {
    ...base,
    fileName,
    imageHash,
    imageUrl,
    sourceName,
    fieldConfidence,
    player: identified.player.value,
    sport: normalizeSport(identified.sport.value),
    team: identified.team.value,
    year: identified.year.value,
    brand: identified.brand.value || "Topps",
    set: identified.set.value,
    cardNumber: identified.cardNumber.value,
    parallel: identified.parallel.value,
    grade: identified.grade.value || "Raw",
    gradingCompany: identified.gradingCompany.value,
    certNumber: identified.certNumber.value,
    tags: normalizeTags(identified.tags),
  };
}

function savedCardToDraft(card: SavedCard, collections: string[]): CardDraft {
  return {
    ...emptyDraft(collections),
    id: card.id,
    player: card.player,
    sport: card.sport,
    team: card.team,
    year: card.year,
    brand: card.brand,
    set: card.set,
    cardNumber: card.cardNumber ?? "",
    parallel: card.parallel ?? "",
    status: card.status,
    grade: card.grade,
    gradingCompany: card.gradingCompany ?? "",
    certNumber: card.certNumber ?? "",
    color: card.color,
    collection: card.collection,
    estimatedValue: card.estimatedValue ?? "",
    purchasePrice: card.purchasePrice ?? "",
    salePrice: card.salePrice ?? "",
    saleStatus: card.saleStatus ?? "Holding",
    frameStyle: card.frameStyle ?? "Card",
    borderStyle: card.borderStyle ?? "Soft",
    imageUrl: card.imageUrl ?? "",
    imageHash: card.imageHash,
    tags: normalizeTags(card.tags),
    imageX: card.imageX ?? 50,
    imageY: card.imageY ?? 50,
    imageZoom: card.imageZoom ?? 100,
    imageRotation: card.imageRotation ?? 0,
    fileName: card.sourceName ?? "Saved card",
  };
}

function confidenceFromIdentifier(identified: IdentifiedCard): Record<string, FieldConfidence> {
  return Object.fromEntries(
    Object.entries(identified)
      .filter(([, value]) => value && typeof value === "object" && "confidence" in value)
      .map(([key, value]) => {
        const field = value as FieldConfidence;
        return [key, field];
      }),
  );
}

function normalizeFieldConfidence(value: unknown): Record<string, FieldConfidence> {
  if (!value || typeof value !== "object") return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, Partial<FieldConfidence>>).map(([key, field]) => [
      key,
      {
        confidence: Math.max(0, Math.min(1, Number(field.confidence) || 0)),
        source:
          field.source === "ebay_aspects" ||
          field.source === "title_parser" ||
          field.source === "ocr" ||
          field.source === "manual"
            ? field.source
            : "title_parser",
        value: typeof field.value === "string" ? field.value : "",
      },
    ]),
  );
}

function normalizeTags(values: unknown): CardTag[] {
  if (!Array.isArray(values)) return [];
  return values.filter((value): value is CardTag => cardTags.includes(value as CardTag));
}

function normalizeSport(value: string) {
  if (value === "Pokemon" || value === "Magic") return "TCG";
  return sports.includes(value) ? value : "Baseball";
}

function toggleTag(tags: CardTag[], tag: CardTag) {
  return tags.includes(tag)
    ? tags.filter((item) => item !== tag)
    : [...tags, tag];
}

async function compressImageFile(file: File, maxWidth: number, quality: number) {
  const dataUrl = await readFile(file);
  const image = await loadImage(dataUrl);
  const scale = Math.min(1, maxWidth / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  if (!context) return dataUrl;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

async function hashImage(imageDataUrl: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(imageDataUrl),
  );
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

const confidenceFieldNames = [
  "brand",
  "cardNumber",
  "certNumber",
  "grade",
  "gradingCompany",
  "parallel",
  "player",
  "set",
  "sport",
  "team",
  "year",
];
