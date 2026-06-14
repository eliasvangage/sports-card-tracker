"use client";

import { useEffect, useMemo, useState } from "react";

type SoldCompsCard = {
  brand?: string;
  cardNumber?: string;
  grade?: string;
  parallel?: string;
  player?: string;
  set?: string;
  year?: string;
};

type SoldComp = {
  condition: string;
  endDate: string;
  imageUrl?: string;
  identity?: {
    cardNumber?: string;
    isChromeBlack?: boolean;
    isRaw?: boolean;
    setHits?: number;
    setTokenCount?: number;
    variantConflicts?: string[];
  };
  matchReasons?: string[];
  matchScore?: number;
  price: number;
  title: string;
  url: string;
};

type SoldCompsResponse = {
  avgPrice: number;
  confidence?: number;
  highPrice: number;
  lastSold?: string;
  lowPrice: number;
  medianPrice?: number;
  nearComps?: SoldComp[];
  outliersTrimmed?: number;
  samples: number;
  comps: SoldComp[];
  dataSource?: "sold" | "active";
  minMatchScore?: number;
  query: string;
  rejected?: number;
  totalFound?: number;
};

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
      cardNumber: card.cardNumber,
      grade: card.grade && card.grade !== "Raw" ? card.grade : "",
      parallel: card.parallel,
      player: card.player,
      set: card.set,
      year: card.year,
    })) {
      if (value?.trim()) params.set(key, value.trim());
    }

    params.set("includeActive", "1");
    return params.toString();
  }, [card.brand, card.cardNumber, card.grade, card.parallel, card.player, card.set, card.year]);

  useEffect(() => {
    let cancelled = false;

    async function loadComps() {
      if (!canFetch || !queryString) {
        setData(null);
        setError("");
        return;
      }

      setIsLoading(true);
      setError("");

      try {
        const response = await fetch(`/api/ebay/comps?${queryString}`);
        const body = await response.json();

        if (!response.ok) {
          throw new Error(body.error ?? "Unable to load eBay comps.");
        }

        if (!cancelled) setData(body);
      } catch (loadError) {
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
    }

    loadComps();

    return () => {
      cancelled = true;
    };
  }, [canFetch, queryString]);

  return (
    <section className="rounded-xl border border-white/10 bg-[linear-gradient(135deg,rgba(22,29,40,0.98),rgba(8,12,18,0.98))] p-3 shadow-[0_18px_42px_rgba(0,0,0,0.28)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
            Market comps
          </p>
          <h4 className="mt-1 text-lg font-black text-white">
            {data?.dataSource === "active" ? "Active fallback" : "Sale comps"}
          </h4>
          <p className="mt-1 text-xs font-bold text-slate-500">
            Exact card identity first. Near matches are separated from value.
          </p>
        </div>
        {data?.query ? (
          <span className="max-w-full truncate rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[10px] font-black text-slate-300">
            {data.query}
          </span>
        ) : null}
      </div>

      {!canFetch ? (
        <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-xs font-bold leading-5 text-slate-400">
          Add at least player and year to scan sold eBay comps.
        </div>
      ) : isLoading ? (
        <CompsSkeleton compact={compact} />
      ) : error ? (
        <div className="mt-3 rounded-lg border border-red-300/20 bg-red-400/10 p-3 text-xs font-bold leading-5 text-red-100">
          {error}
        </div>
      ) : data && data.samples > 0 ? (
        <>
          <MarketSourceNote data={data} />
          <MarketSummary compact={compact} data={data} onValueAccepted={onValueAccepted} />
          <div className="mt-3 grid gap-2">
            {data.comps.slice(0, compact ? 2 : 5).map((comp) => (
              <MarketCompRow key={`${comp.url}-${comp.price}`} comp={comp} compact={compact} />
            ))}
          </div>
          {!compact && data.nearComps?.length ? (
            <details className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
              <summary className="cursor-pointer list-none text-xs font-black text-slate-300">
                Near matches excluded from value ({data.nearComps.length})
              </summary>
              <div className="mt-3 grid gap-2">
                {data.nearComps.map((comp) => (
                  <MarketCompRow key={`${comp.url}-${comp.price}`} comp={comp} muted />
                ))}
              </div>
            </details>
          ) : null}
        </>
      ) : (
        <EmptyComps data={data} />
      )}
    </section>
  );
}

function EmptyComps({ data }: { data: SoldCompsResponse | null }) {
  return (
    <div className="mt-3 grid gap-3 rounded-lg border border-white/10 bg-black/20 p-3 text-xs font-bold leading-5 text-slate-400">
      <p>
        No exact comps survived the identity filters. The search found{" "}
        {data?.totalFound ?? 0} raw result{(data?.totalFound ?? 0) === 1 ? "" : "s"}
        {typeof data?.rejected === "number" && data.rejected > 0
          ? ` and rejected ${data.rejected} wrong-card match${data.rejected === 1 ? "" : "es"}`
          : ""}.
      </p>
      {data?.nearComps?.length ? (
        <div className="grid gap-2">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
            Closest rejected results
          </p>
          {data.nearComps.slice(0, 3).map((comp) => (
            <MarketCompRow key={`${comp.url}-${comp.price}`} comp={comp} muted />
          ))}
        </div>
      ) : null}
      {data?.query ? (
        <a
          href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(data.query)}&LH_Sold=1&LH_Complete=1`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 w-fit items-center rounded-md border border-white/10 bg-white/5 px-3 text-[11px] font-black text-slate-200 hover:bg-white/10"
        >
          Open sold search
        </a>
      ) : null}
    </div>
  );
}

function MarketSummary({
  compact = false,
  data,
  onValueAccepted,
}: {
  compact?: boolean;
  data: SoldCompsResponse;
  onValueAccepted: (value: number) => void;
}) {
  const isActive = data.dataSource === "active";

  return (
    <>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-emerald-300/20 bg-[radial-gradient(circle_at_20%_0%,rgba(110,231,183,0.18),transparent_42%),rgba(16,185,129,0.10)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100/70">
            {isActive ? "Avg ask" : "Sale avg"}
          </p>
          <p className="mt-1 text-2xl font-black text-emerald-200">
            {formatMoney(data.avgPrice)}
          </p>
          <p className="mt-1 text-[10px] font-bold text-emerald-100/60">
            median {formatMoney(data.medianPrice ?? data.avgPrice)}
          </p>
        </div>
        <CompsMetric label="Low" value={formatMoney(data.lowPrice)} />
        <CompsMetric label="High" value={formatMoney(data.highPrice)} />
      </div>

      {!compact ? (
        <DealRangeBar
          high={data.highPrice}
          low={data.lowPrice}
          median={data.medianPrice ?? data.avgPrice}
        />
      ) : null}

      <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-black text-white">
              {data.samples} {isActive ? "active listing" : "exact sale comp"}
              {data.samples === 1 ? "" : "s"}
            </p>
            <p className="mt-1 text-[10px] font-bold text-slate-500">
              Confidence {data.confidence ?? 0}%
              {data.lastSold ? ` / latest ${formatDate(data.lastSold)}` : ""}
              {data.outliersTrimmed
                ? ` / ${data.outliersTrimmed} outlier${data.outliersTrimmed === 1 ? "" : "s"} trimmed`
                : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onValueAccepted(data.avgPrice)}
            className="h-9 rounded-lg bg-[#ff5533] px-3 text-xs font-black text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isActive}
            title={isActive ? "Active listings are not sold comps." : undefined}
          >
            {isActive ? "Review asks" : compact ? "Use estimate" : "Use sale average"}
          </button>
        </div>
      </div>
    </>
  );
}

function DealRangeBar({ high, low, median }: { high: number; low: number; median: number }) {
  const marker = high > low ? Math.min(100, Math.max(0, ((median - low) / (high - low)) * 100)) : 50;

  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="relative h-2 rounded-full bg-[linear-gradient(90deg,#22c55e,#f59e0b,#ef4444)]">
        <span
          className="absolute top-1/2 size-4 -translate-y-1/2 rounded-full border-2 border-white bg-[#111722] shadow-lg"
          style={{ left: `calc(${marker}% - 0.5rem)` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[10px] font-black text-slate-400">
        <span>deal {formatMoney(low)}</span>
        <span>median {formatMoney(median)}</span>
        <span>high {formatMoney(high)}</span>
      </div>
    </div>
  );
}

function MarketCompRow({
  compact = false,
  comp,
  muted = false,
}: {
  compact?: boolean;
  comp: SoldComp;
  muted?: boolean;
}) {
  const identityChips = [
    comp.identity?.cardNumber ? `#${comp.identity.cardNumber}` : "",
    comp.identity?.isChromeBlack ? "Chrome Black" : "",
    comp.identity?.isRaw ? "Raw" : "",
  ].filter(Boolean);

  return (
    <a
      href={comp.url}
      target="_blank"
      rel="noreferrer"
      className={`grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 rounded-lg border p-2.5 transition hover:-translate-y-0.5 ${
        muted
          ? "border-white/10 bg-white/[0.025] opacity-75 hover:bg-white/[0.05]"
          : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/[0.06]"
      }`}
    >
      {comp.imageUrl ? (
        <span
          className={`${compact ? "h-9 w-7" : "h-12 w-9"} rounded bg-cover bg-center ring-1 ring-white/10`}
          style={{ backgroundImage: `url(${comp.imageUrl})` }}
        />
      ) : (
        <span className={`${compact ? "h-9 w-7" : "h-12 w-9"} rounded border border-white/10 bg-white/[0.03]`} />
      )}
      <div className="min-w-0">
        <p className={`${compact ? "text-[11px]" : "text-xs"} truncate font-black text-white`}>
          {comp.title}
        </p>
        <p className="mt-1 truncate text-[10px] font-bold text-slate-500">
          {comp.matchScore ?? 0}% match
          {comp.matchReasons?.length ? ` / ${comp.matchReasons.join(", ")}` : ""}
        </p>
        {!compact && identityChips.length ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {identityChips.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-black text-slate-300"
              >
                {chip}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <span className="text-right text-sm font-black text-emerald-200">
        {formatMoney(comp.price)}
        {comp.endDate ? (
          <span className="block text-[9px] font-bold text-slate-500">
            {formatDate(comp.endDate)}
          </span>
        ) : null}
      </span>
    </a>
  );
}

function MarketSourceNote({ data }: { data: SoldCompsResponse }) {
  if (data.dataSource !== "active") {
    return (
      <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-2.5 text-[11px] font-bold leading-5 text-slate-400">
        Sold sales only. Wrong card numbers, wrong sets, graded/raw conflicts,
        and variant conflicts are excluded from value.
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/10 p-2.5 text-[11px] font-bold leading-5 text-amber-100">
      No exact sold comps came back from eBay, so this shows exact active listings
      for context. Active ask prices are not saved as confirmed value.
    </div>
  );
}

function CompsMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/25 p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function CompsSkeleton({ compact }: { compact: boolean }) {
  return (
    <div className="mt-3 grid gap-2">
      <div className="grid gap-2 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="h-20 animate-pulse rounded-lg border border-white/10 bg-white/[0.05]"
          />
        ))}
      </div>
      {Array.from({ length: compact ? 2 : 4 }).map((_, index) => (
        <div
          key={index}
          className="h-12 animate-pulse rounded-lg border border-white/10 bg-white/[0.04]"
        />
      ))}
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

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
