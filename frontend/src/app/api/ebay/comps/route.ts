import { NextResponse } from "next/server";
import { EbayConfigError, getEbayAppToken } from "@/lib/ebay";
import { checkRateLimit, requestIdentifier } from "@/lib/rate-limit";

type EbayCompItem = {
  condition?: string;
  itemEndDate?: string;
  itemWebUrl?: string;
  price?: {
    currency?: string;
    value?: string;
  };
  title?: string;
};

type CompResult = {
  condition: string;
  endDate: string;
  price: number;
  title: string;
  url: string;
};

const allowedParams = ["player", "year", "brand", "set", "parallel", "grade"] as const;

export async function GET(request: Request) {
  const rateLimit = checkRateLimit({
    identifier: `ebay-comps:${requestIdentifier(request)}`,
    limit: 20,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many eBay comp searches. Try again in a minute." },
      { status: 429 },
    );
  }

  const { searchParams } = new URL(request.url);
  const fields = Object.fromEntries(
    allowedParams.map((key) => [key, cleanSearchPart(searchParams.get(key))]),
  ) as Record<(typeof allowedParams)[number], string>;
  const query = buildCompQuery(fields);

  if (query.length < 3) {
    return NextResponse.json(
      { error: "Comp search needs at least a player, year, or brand." },
      { status: 400 },
    );
  }

  let response: Response;

  try {
    const token = await getEbayAppToken();
    response = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?${new URLSearchParams({
        category_ids: "212",
        limit: "20",
        q: query,
      }).toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof EbayConfigError
            ? "eBay comps are ready, but the server eBay credentials are not configured yet."
            : "Unable to connect to eBay comps right now.",
      },
      { status: error instanceof EbayConfigError ? 501 : 502 },
    );
  }

  if (!response.ok) {
    return NextResponse.json(
      { error: "eBay comps did not return results." },
      { status: response.status },
    );
  }

  const body = (await response.json()) as { itemSummaries?: EbayCompItem[] };
  const comps = (body.itemSummaries ?? [])
    .map(toCompResult)
    .filter((comp): comp is CompResult => Boolean(comp))
    .filter((comp) => titleMatchesCoreFields(comp.title, fields))
    .slice(0, 10);
  const prices = comps.map((comp) => comp.price);

  return NextResponse.json({
    avgPrice: averagePrice(prices),
    lowPrice: prices.length ? Math.min(...prices) : 0,
    highPrice: prices.length ? Math.max(...prices) : 0,
    samples: comps.length,
    comps: comps.slice(0, 5),
    query,
  });
}

function cleanSearchPart(value: string | null) {
  return (value ?? "")
    .replace(/[^\w\s./#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function buildCompQuery(fields: Record<(typeof allowedParams)[number], string>) {
  return [
    fields.year,
    fields.brand,
    fields.set,
    fields.player,
    fields.parallel,
    fields.grade,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

function toCompResult(item: EbayCompItem) {
  const price = Number(item.price?.value);

  if (!item.title || !item.itemWebUrl || !Number.isFinite(price) || price <= 0) {
    return null;
  }

  return {
    condition: item.condition ?? "",
    endDate: item.itemEndDate ?? "",
    price: Math.round(price * 100) / 100,
    title: item.title,
    url: item.itemWebUrl,
  };
}

function titleMatchesCoreFields(
  title: string,
  fields: Record<(typeof allowedParams)[number], string>,
) {
  const lowerTitle = title.toLowerCase();
  const coreFields = [fields.player, fields.year, fields.brand].filter(Boolean);

  if (coreFields.length === 0) return true;

  return coreFields.every((field) =>
    field
      .toLowerCase()
      .split(/\s+/)
      .filter((part) => part.length > 1)
      .some((part) => lowerTitle.includes(part)),
  );
}

function averagePrice(prices: number[]) {
  if (prices.length === 0) return 0;

  const total = prices.reduce((sum, price) => sum + price, 0);
  return Math.round((total / prices.length) * 100) / 100;
}
