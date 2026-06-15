"use client";

import { useEffect, useMemo, useState } from "react";

type SoldCompsCard = {
  brand?: string;
  grade?: string;
  parallel?: string;
  player?: string;
  set?: string;
  year?: string;
};

type CompSource = "sold" | "active";
type Confidence = "high" | "medium" | "low";

type SoldComp = {
  condition: string;
  endDate: string;
  imageUrl: string;
  price: number;
  source: CompSource;
  title: string;
  url: string;
};

type NearMatch = {
  price: number;
  reason: "outlier_high" | "outlier_low";
  title: string;
  url: string;
};

type SoldCompsResponse = {
  avgPrice: number;
  medianPrice: number;
  lowPrice: number;
  highPrice: number;
  samples: number;
  totalFound: number;
  outliersTrimmed: number;
  confidence: Confidence;
  source: "sold" | "active" | "mixed";
  query: string;
  comps: SoldComp[];
  nearMatches: NearMatch[];
};

const compsCache = new Map<string, SoldCompsResponse>();

export function SoldComps({
  card,
  compact = false,
  onValueAccepted,
}: {
  card: SoldCompsCard;
  compact?: boolean;
  onValueAccepted: (value: number) => void;
}) {
  const [data, setData] = useState<SoldCompsResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const canFetch = Boolean(card.player?.trim() && card.year?.trim());
  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries({
      brand: card.brand,
      grade: card.grade && card.grade !== "Raw" ? card.grade : "",
      parallel: card.parallel,
      player: card.player,
      set: card.set,
      year: card.year,
    })) {
      if (value?.trim()) params.set(key, value.trim());
    }

    return params.toString();
  }, [card.brand, card.grade, card.parallel, card.player, card.set, card.year]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      if (!canFetch || !queryString) {
        setData(null);
        setError("");
        return;
      }

      const cached = compsCache.get(queryString);
      if (cached) {
        setData(cached);
        setError("");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError("");

      try {
        const response = await fetch(`/api/ebay/comps?${queryString}`, {
          signal: controller.signal,
        });
        const body = await response.json();

        if (!response.ok) {
          throw new Error(body.error ?? "Unable to load eBay comps.");
        }

        compsCache.set(queryString, body);
        if (!cancelled) setData(body);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        if (!cancelled) {
          setData(null);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load eBay comps.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 800);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [canFetch, queryString]);

  return (
    <section className="rounded-xl border border-white/10 bg-[#151b24] p-4 shadow-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
            Recent sales
          </p>
          <p className="mt-1 max-w-full truncate text-xs font-bold text-slate-500">
            {data?.query ?? "Waiting for card details"}
          </p>
        </div>
        {data ? <ConfidenceBadge confidence={data.confidence} /> : null}
      </div>

      {!canFetch ? (
        <EmptyMessage
          card={card}
          text="Add at least player and year to scan sold eBay comps."
        />
      ) : isLoading ? (
        <CompsSkeleton compact={compact} />
      ) : error ? (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-bold leading-5 text-red-100">
          {error}
        </div>
      ) : data && data.samples > 0 ? (
        <>
          <div className="mt-4 rounded-2xl border border-white/10 bg-[#0d111a] p-4 shadow-[0_0_30px_rgba(255,85,51,0.10)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-4xl font-black text-emerald-300">
                  {formatMoney(data.avgPrice)}
                </p>
                <p className="mt-2 text-xs font-bold text-slate-400">
                  median {formatMoney(data.medianPrice)} | low{" "}
                  {formatMoney(data.lowPrice)} | high {formatMoney(data.highPrice)}
                </p>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  {data.samples} {data.source === "active" ? "active listing" : "sold comp"}
                  {data.samples === 1 ? "" : "s"}
                </p>
              </div>
              <SourceBadge source={data.source} confidence={data.confidence} />
            </div>
            {data.source === "active" ? (
              <p className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs font-bold leading-5 text-amber-100">
                Active listings only - no recent sales found.
              </p>
            ) : data.confidence === "low" ? (
              <p className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs font-bold leading-5 text-amber-100">
                Estimated - fewer than 3 comps found.
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => onValueAccepted(data.avgPrice)}
            disabled={data.source === "active"}
            className="mt-3 h-10 w-full rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-black text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {data.source === "active" ? "Active listings only" : "Use as estimated value"}
          </button>

          <div className="mt-4 grid gap-2">
            {data.comps.slice(0, compact ? 3 : 5).map((comp) => (
              <CompRow key={`${comp.url}-${comp.price}`} comp={comp} compact={compact} />
            ))}
          </div>

          {data.nearMatches.length ? (
            <details className="mt-4 rounded-xl border border-white/10 bg-[#0d111a] p-3">
              <summary className="cursor-pointer list-none text-xs font-black text-slate-300">
                {data.nearMatches.length} outlier{data.nearMatches.length === 1 ? "" : "s"} removed
              </summary>
              <div className="mt-3 grid gap-2">
                {data.nearMatches.map((match) => (
                  <a
                    key={`${match.url}-${match.price}`}
                    href={match.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-3 hover:bg-white/[0.06]"
                  >
                    <div className="flex justify-between gap-3">
                      <p className="truncate text-xs font-black text-white">
                        {trimTitle(match.title)}
                      </p>
                      <p className="text-xs font-black text-white">
                        {formatMoney(match.price)}
                      </p>
                    </div>
                    <p className="mt-1 text-[10px] font-bold text-slate-500">
                      {match.reason === "outlier_high" ? "Unusually high" : "Unusually low"} ({formatMoney(match.price)})
                    </p>
                  </a>
                ))}
              </div>
            </details>
          ) : null}
        </>
      ) : (
        <EmptyMessage card={card} text="No recent sales found for this card." />
      )}
    </section>
  );
}

function CompRow({ compact, comp }: { compact: boolean; comp: SoldComp }) {
  return (
    <a
      href={comp.url}
      target="_blank"
      rel="noreferrer"
      className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-xl border border-white/10 bg-[#0d111a] p-3 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.04]"
    >
      <div className="min-w-0">
        <p className={`${compact ? "text-[11px]" : "text-xs"} truncate font-black text-white`}>
          {trimTitle(comp.title)}
        </p>
        <p className="mt-1 text-[10px] font-bold text-slate-500">
          {formatDate(comp.endDate)}
          {comp.condition ? (
            <span className="ml-2 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] text-slate-400">
              {comp.condition}
            </span>
          ) : null}
          {comp.source === "active" ? (
            <span className="ml-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[9px] text-amber-100">
              active
            </span>
          ) : null}
        </p>
      </div>
      <p className="text-sm font-black text-white">{formatMoney(comp.price)}</p>
    </a>
  );
}

function EmptyMessage({ card, text }: { card: SoldCompsCard; text: string }) {
  const href = soldSearchUrl(card);

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-[#0d111a] p-4 text-xs font-bold leading-5 text-slate-300">
      <p>{text}</p>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex h-10 items-center rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-black text-slate-200 hover:bg-white/10"
        >
          Try searching eBay manually -&gt;
        </a>
      ) : null}
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const classes = {
    high: "border-emerald-500/25 bg-emerald-500/10 text-emerald-200",
    medium: "border-amber-500/25 bg-amber-500/10 text-amber-100",
    low: "border-red-500/25 bg-red-500/10 text-red-100",
  };

  return (
    <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${classes[confidence]}`}>
      {confidence}
    </span>
  );
}

function SourceBadge({
  confidence,
  source,
}: {
  confidence: Confidence;
  source: SoldCompsResponse["source"];
}) {
  if (source === "active") {
    return (
      <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-100">
        Active only
      </span>
    );
  }

  if (source === "mixed") {
    return (
      <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-100">
        Mixed
      </span>
    );
  }

  return <ConfidenceBadge confidence={confidence} />;
}

function CompsSkeleton({ compact }: { compact: boolean }) {
  return (
    <div className="mt-4 grid gap-2">
      <div className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/[0.05]" />
      {Array.from({ length: compact ? 2 : 3 }).map((_, index) => (
        <div
          key={index}
          className="h-14 animate-pulse rounded-xl border border-white/10 bg-white/[0.04]"
        />
      ))}
    </div>
  );
}

function trimTitle(value: string) {
  return value.length > 40 ? `${value.slice(0, 40)}...` : value;
}

function soldSearchUrl(card: SoldCompsCard) {
  const query = [
    card.year,
    card.brand,
    card.set,
    card.player,
    card.parallel,
    card.grade && card.grade !== "Raw" ? card.grade : "",
  ]
    .filter(Boolean)
    .join(" ");

  return query
    ? `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1`
    : "";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "No date";

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}
