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

type SoldComp = {
  condition: string;
  endDate: string;
  price: number;
  title: string;
  url: string;
};

type SoldCompsResponse = {
  avgPrice: number;
  lowPrice: number;
  highPrice: number;
  samples: number;
  comps: SoldComp[];
  dataSource?: "sold" | "active";
  query: string;
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
    <section className="rounded-xl border border-white/10 bg-[linear-gradient(135deg,rgba(21,27,36,0.98),rgba(8,12,18,0.98))] p-3 shadow-[0_18px_42px_rgba(0,0,0,0.28)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
            eBay comps
          </p>
          <h4 className="mt-1 text-lg font-black text-white">
            {data?.dataSource === "sold" ? "Sold comps" : "Market estimate"}
          </h4>
          <p className="mt-1 text-xs font-bold text-slate-500">
            {data?.dataSource === "sold"
              ? "Completed eBay sales with outliers trimmed."
              : "Active listing signal while sold data is unavailable."}
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
          Add at least player and year to scan recent eBay listings.
        </div>
      ) : isLoading ? (
        <CompsSkeleton compact={compact} />
      ) : error ? (
        <div className="mt-3 rounded-lg border border-red-300/20 bg-red-400/10 p-3 text-xs font-bold leading-5 text-red-100">
          {error}
        </div>
      ) : compact && data && data.samples > 0 ? (
        <div className="mt-3 grid gap-2">
          <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100/70">
                  Average
                </p>
                <p className="mt-1 text-2xl font-black text-emerald-200">
                  {formatMoney(data.avgPrice)}
                </p>
              </div>
              <p className="text-right text-[10px] font-bold leading-4 text-slate-400">
                {data.samples} samples<br />
                {formatMoney(data.lowPrice)} to {formatMoney(data.highPrice)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onValueAccepted(data.avgPrice)}
              className="mt-3 h-8 w-full rounded-md bg-[#ff5533] px-3 text-[11px] font-black text-white hover:brightness-110"
            >
              Use estimate
            </button>
          </div>
          {data.comps.slice(0, 2).map((comp) => (
            <a
              key={`${comp.url}-${comp.price}`}
              href={comp.url}
              target="_blank"
              rel="noreferrer"
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-lg border border-white/10 bg-black/20 p-2 text-left hover:bg-white/[0.06]"
            >
              <span className="truncate text-[11px] font-bold text-slate-300">
                {comp.title}
              </span>
              <span className="text-xs font-black text-emerald-200">
                {formatMoney(comp.price)}
              </span>
            </a>
          ))}
        </div>
      ) : data && data.samples > 0 ? (
        <>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-emerald-300/20 bg-[radial-gradient(circle_at_20%_0%,rgba(110,231,183,0.18),transparent_42%),rgba(16,185,129,0.10)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100/70">
                Average
              </p>
              <p className="mt-1 text-2xl font-black text-emerald-200">
                {formatMoney(data.avgPrice)}
              </p>
            </div>
            <CompsMetric label="Low" value={formatMoney(data.lowPrice)} />
            <CompsMetric label="High" value={formatMoney(data.highPrice)} />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 p-2.5">
            <p className="text-xs font-bold text-slate-400">
              {data.samples} {data.dataSource === "sold" ? "sold eBay comps" : "recent eBay listings"}
            </p>
            <button
              type="button"
              onClick={() => onValueAccepted(data.avgPrice)}
              className="h-9 rounded-lg bg-[#ff5533] px-3 text-xs font-black text-white hover:brightness-110"
            >
              Use as estimated value
            </button>
          </div>
          <div className="mt-3 grid gap-2">
            {data.comps.slice(0, compact ? 3 : 5).map((comp) => (
              <a
                key={`${comp.url}-${comp.price}`}
                href={comp.url}
                target="_blank"
                rel="noreferrer"
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-lg border border-white/10 bg-black/20 p-2.5 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06]"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-black text-white">
                    {comp.title}
                  </p>
                  <p className="mt-1 truncate text-[10px] font-bold text-slate-500">
                    {comp.condition || "Condition not listed"}
                  </p>
                </div>
                <span className="text-sm font-black text-emerald-200">
                  {formatMoney(comp.price)}
                </span>
              </a>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-xs font-bold leading-5 text-slate-400">
          No recent eBay listings matched this card. Try removing grade or
          parallel, or verify the player/year fields.
        </div>
      )}
    </section>
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

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}
