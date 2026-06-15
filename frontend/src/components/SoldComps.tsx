"use client";

import { useEffect, useMemo, useState } from "react";

type SoldCompsCard = {
  brand?: string;
  cardNumber?: string;
  grade?: string;
  parallel?: string;
  player?: string;
  set?: string;
  tags?: string[];
  year?: string;
};

type SoldComp = {
  condition: string;
  endDate: string;
  imageUrl: string;
  price: number;
  source: "active";
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
  confidence: "high" | "medium" | "low";
  source: "active";
  query: string;
  comps: SoldComp[];
  filteredOut?: number;
  nearMatches: Array<{
    price: number;
    reason: "outlier_high" | "outlier_low";
    title: string;
    url: string;
  }>;
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
      cardNumber: card.cardNumber,
      grade: card.grade && card.grade !== "Raw" ? card.grade : "",
      parallel: card.parallel,
      player: card.player,
      set: card.set,
      tags: card.tags?.join(","),
      year: card.year,
    })) {
      if (value?.trim()) params.set(key, value.trim());
    }

    return params.toString();
  }, [card.brand, card.cardNumber, card.grade, card.parallel, card.player, card.set, card.tags, card.year]);

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
          throw new Error(body.error ?? "Unable to load eBay market.");
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
              : "Unable to load eBay market.",
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
    <section className="overflow-hidden rounded-xl border border-white/10 bg-[#151b24] shadow-2xl">
      <div className="border-b border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.015))] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
              Current listings
            </p>
            <p className="mt-1 max-w-full truncate text-xs font-bold text-slate-400">
              {data?.query ?? "Enter the card identity to compare exact active eBay listings."}
            </p>
          </div>
          {data?.samples ? (
            <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-100">
              eBay active
            </span>
          ) : null}
        </div>
      </div>

      <div className="p-4">
        {!canFetch ? (
          <EmptyMessage
            card={card}
            text="Add a player and year to check exact current listings."
          />
        ) : isLoading ? (
          <CompsSkeleton compact={compact} />
        ) : error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-bold leading-5 text-red-100">
            {error}
          </div>
        ) : data && data.samples > 0 ? (
          <MarketBoard
            card={card}
            compact={compact}
            data={data}
            onValueAccepted={onValueAccepted}
          />
        ) : (
          <EmptyMessage card={card} text="No exact current listings found for this card." />
        )}
      </div>
    </section>
  );
}

function MarketBoard({
  card,
  compact,
  data,
  onValueAccepted,
}: {
  card: SoldCompsCard;
  compact: boolean;
  data: SoldCompsResponse;
  onValueAccepted: (value: number) => void;
}) {
  const visibleComps = data.comps.slice(0, compact ? 3 : 5);

  return (
    <div className="grid gap-4">
      <div className="rounded-xl border border-white/10 bg-[#0d111a] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              Exact average ask
            </p>
            <p className="mt-1 text-4xl font-black text-emerald-300">
              {formatMoney(data.avgPrice)}
            </p>
            <p className="mt-2 text-xs font-bold text-slate-500">
              Current eBay asks filtered by player, set, card number, and finish.
            </p>
          </div>
          <div className="shrink-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-right">
            <p className="text-lg font-black text-white">{data.samples}</p>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
              listing{data.samples === 1 ? "" : "s"}
            </p>
            <p className="mt-1 text-[11px] font-bold text-slate-400">
              {formatMoney(data.lowPrice)} - {formatMoney(data.highPrice)}
            </p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onValueAccepted(data.avgPrice)}
        className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-black text-slate-200 hover:bg-white/10"
      >
        Use as estimated value
      </button>

      {!compact ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleComps.map((comp) => (
            <CompCard key={`${comp.url}-${comp.price}`} comp={comp} />
          ))}
        </div>
      ) : (
        <div className="grid gap-2">
          {visibleComps.map((comp) => (
            <CompRow key={`${comp.url}-${comp.price}`} comp={comp} compact={compact} />
          ))}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <a
          href={ebaySearchUrl(card)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-black text-slate-200 hover:bg-white/10"
        >
          Open eBay search
        </a>
        <a
          href={oneThirtyPointUrl(card)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-[#ff5533]/30 bg-[#ff5533]/10 px-4 text-sm font-black text-orange-100 hover:bg-[#ff5533]/15"
        >
          Check 130point sales
        </a>
      </div>
    </div>
  );
}

function CompCard({ comp }: { comp: SoldComp }) {
  return (
    <a
      href={comp.url}
      target="_blank"
      rel="noreferrer"
      className="group overflow-hidden rounded-xl border border-white/10 bg-[#0d111a] transition hover:-translate-y-0.5 hover:border-white/20"
    >
      <div className="relative aspect-[4/5] bg-black/30">
        {comp.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={comp.imageUrl} alt="" className="h-full w-full object-contain" />
        ) : (
          <div className="grid h-full place-items-center text-xs font-black text-slate-500">No image</div>
        )}
        <span className="absolute bottom-2 left-2 rounded bg-white px-2 py-0.5 text-[10px] font-black text-[#111722]">
          eBay
        </span>
      </div>
      <div className="p-3">
        <p className="line-clamp-2 min-h-9 text-xs font-black leading-4 text-white">
          {comp.title}
        </p>
        <p className="mt-2 text-lg font-black text-emerald-300">{formatMoney(comp.price)}</p>
        <p className="mt-1 text-[10px] font-bold text-slate-500">{formatDate(comp.endDate)}</p>
      </div>
    </a>
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
        <p className={`${compact ? "text-[11px]" : "text-sm"} truncate font-black text-white`}>
          {trimTitle(comp.title, compact ? 46 : 70)}
        </p>
        <p className="mt-1 text-[10px] font-bold text-slate-500">
          {formatDate(comp.endDate)}
          {comp.condition ? (
            <span className="ml-2 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] text-slate-400">
              {comp.condition}
            </span>
          ) : null}
        </p>
      </div>
      <p className="text-sm font-black text-white">{formatMoney(comp.price)}</p>
    </a>
  );
}

function EmptyMessage({ card, text }: { card: SoldCompsCard; text: string }) {
  const href = ebaySearchUrl(card);
  const researchHref = oneThirtyPointUrl(card);

  return (
    <div className="rounded-xl border border-white/10 bg-[#0d111a] p-4 text-xs font-bold leading-5 text-slate-300">
      <p>{text}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-black text-slate-200 hover:bg-white/10"
          >
            Search eBay -&gt;
          </a>
        ) : null}
        <a
          href={researchHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-[#ff5533]/30 bg-[#ff5533]/10 px-4 text-sm font-black text-orange-100 hover:bg-[#ff5533]/15"
        >
          Check 130point -&gt;
        </a>
      </div>
    </div>
  );
}

function CompsSkeleton({ compact }: { compact: boolean }) {
  return (
    <div className="grid gap-2">
      <div className="grid gap-2 sm:grid-cols-4">
        {Array.from({ length: compact ? 2 : 4 }).map((_, index) => (
          <div
            key={index}
            className="h-20 animate-pulse rounded-xl border border-white/10 bg-white/[0.05]"
          />
        ))}
      </div>
      {Array.from({ length: compact ? 2 : 3 }).map((_, index) => (
        <div
          key={index}
          className="h-14 animate-pulse rounded-xl border border-white/10 bg-white/[0.04]"
        />
      ))}
    </div>
  );
}

function trimTitle(value: string, max = 48) {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function ebaySearchUrl(card: SoldCompsCard) {
  const query = [
    card.year,
    card.brand,
    card.set,
    card.player,
    card.cardNumber ? `#${card.cardNumber}` : "",
    card.parallel,
    card.grade && card.grade !== "Raw" ? card.grade : "",
  ]
    .filter(Boolean)
    .join(" ");

  return query
    ? `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}`
    : "";
}

function oneThirtyPointUrl(card: SoldCompsCard) {
  const query = [
    card.year,
    card.brand,
    card.set,
    card.player,
    card.cardNumber ? `#${card.cardNumber}` : "",
    card.parallel,
  ]
    .filter(Boolean)
    .join(" ");

  return `https://130point.com/sales/?search=${encodeURIComponent(query)}`;
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
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
}
