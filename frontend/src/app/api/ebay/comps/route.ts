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
  imageUrl?: string;
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

  let comps: CompResult[] | null = null;
  let dataSource = "active";

  try {
    const soldResults = await findCompletedComps(query, fields);
    comps = soldResults ?? (await findActiveComps(query, fields));
    dataSource = soldResults ? "sold" : "active";
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

  if (!comps) {
    return NextResponse.json(
      { error: "eBay comps are unavailable right now." },
      { status: 503 },
    );
  }

  const filteredComps = removeOutliers(comps).slice(0, 10);
  const prices = filteredComps.map((comp) => comp.price);

  return NextResponse.json({
    avgPrice: averagePrice(prices),
    lowPrice: prices.length ? Math.min(...prices) : 0,
    highPrice: prices.length ? Math.max(...prices) : 0,
    samples: filteredComps.length,
    totalFound: comps.length,
    outliersTrimmed: Math.max(0, comps.length - filteredComps.length),
    comps: filteredComps.slice(0, 5),
    dataSource,
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
    fields.player,
    fields.grade,
    fields.parallel.split(" ")[0],
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

async function findCompletedComps(
  query: string,
  fields: Record<(typeof allowedParams)[number], string>,
): Promise<CompResult[] | null> {
  const appId = process.env.EBAY_APP_ID || process.env.EBAY_CLIENT_ID;
  if (!appId) return null;

  const response = await fetch(
    `https://svcs.ebay.com/services/search/FindingService/v1?${new URLSearchParams({
      "OPERATION-NAME": "findCompletedItems",
      "RESPONSE-DATA-FORMAT": "JSON",
      "SECURITY-APPNAME": appId,
      "SERVICE-VERSION": "1.0.0",
      categoryId: "212",
      "itemFilter(0).name": "SoldItemsOnly",
      "itemFilter(0).value": "true",
      "itemFilter(1).name": "ListingType",
      "itemFilter(1).value": "AuctionWithBIN,FixedPrice,Auction",
      keywords: query,
      "paginationInput.entriesPerPage": "20",
      sortOrder: "EndTimeSoonest",
    }).toString()}`,
  );

  if (!response.ok) return null;

  const body = (await response.json()) as {
    findCompletedItemsResponse?: Array<{
      searchResult?: Array<{
        item?: Array<{
          condition?: Array<{ conditionDisplayName?: string[] }>;
          galleryURL?: string[];
          listingInfo?: Array<{ endTime?: string[] }>;
          sellingStatus?: Array<{
            soldPrice?: Array<{ __value__?: string }>;
          }>;
          title?: string[];
          viewItemURL?: string[];
        }>;
      }>;
    }>;
  };
  const items = body.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item ?? [];
  const comps = items
    .map((item): CompResult | null => {
      const price = Number(item.sellingStatus?.[0]?.soldPrice?.[0]?.__value__);
      const title = item.title?.[0] ?? "";
      const url = item.viewItemURL?.[0] ?? "";

      if (!title || !url || !Number.isFinite(price) || price <= 0) return null;

      return {
        condition: item.condition?.[0]?.conditionDisplayName?.[0] ?? "",
        endDate: item.listingInfo?.[0]?.endTime?.[0] ?? "",
        imageUrl: item.galleryURL?.[0] ?? "",
        price: Math.round(price * 100) / 100,
        title,
        url,
      };
    })
    .filter(isCompResult)
    .filter((comp) => titleMatchesCoreFields(comp.title, fields));

  return comps.length ? comps : null;
}

async function findActiveComps(
  query: string,
  fields: Record<(typeof allowedParams)[number], string>,
): Promise<CompResult[] | null> {
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
    if (error instanceof EbayConfigError) throw error;
    return null;
  }

  if (!response.ok) return null;

  const body = (await response.json()) as { itemSummaries?: EbayCompItem[] };
  const comps = (body.itemSummaries ?? [])
    .map(toCompResult)
    .filter(isCompResult)
    .filter((comp) => titleMatchesCoreFields(comp.title, fields));

  return comps.length ? comps : null;
}

function toCompResult(item: EbayCompItem): CompResult | null {
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

function isCompResult(comp: CompResult | null): comp is CompResult {
  return comp !== null;
}

function removeOutliers(comps: CompResult[]) {
  if (comps.length < 4) return comps;

  const prices = comps.map((comp) => comp.price).sort((a, b) => a - b);
  const q1 = prices[Math.floor(prices.length * 0.25)];
  const q3 = prices[Math.floor(prices.length * 0.75)];
  const iqr = q3 - q1;
  const low = q1 - 1.5 * iqr;
  const high = q3 + 1.5 * iqr;

  return comps.filter((comp) => comp.price >= low && comp.price <= high);
}
