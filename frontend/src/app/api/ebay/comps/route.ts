import { NextResponse } from "next/server";
import { EbayConfigError, getEbayAppToken } from "@/lib/ebay";
import { checkRateLimit, requestIdentifier } from "@/lib/rate-limit";

type CompSource = "sold" | "active";
type ApiSource = CompSource | "mixed";
type Confidence = "high" | "medium" | "low";
type NearMatchReason = "outlier_high" | "outlier_low";

type CardFields = {
  brand: string;
  grade: string;
  parallel: string;
  player: string;
  set: string;
  year: string;
};

type FindingItem = {
  condition?: Array<{ conditionDisplayName?: string[] }>;
  galleryURL?: string[];
  listingInfo?: Array<{ endTime?: string[] }>;
  sellingStatus?: Array<{
    convertedCurrentPrice?: Array<{ __value__?: string }>;
    currentPrice?: Array<{ __value__?: string }>;
    soldPrice?: Array<{ __value__?: string }>;
  }>;
  title?: string[];
  viewItemURL?: string[];
};

type BrowseItem = {
  condition?: string;
  image?: { imageUrl?: string };
  itemCreationDate?: string;
  itemEndDate?: string;
  itemWebUrl?: string;
  price?: { value?: string };
  title?: string;
};

type RawComp = {
  condition: string;
  endDate: string;
  imageUrl: string;
  price: number;
  source: CompSource;
  title: string;
  url: string;
};

type CompResponse = {
  avgPrice: number;
  medianPrice: number;
  lowPrice: number;
  highPrice: number;
  samples: number;
  totalFound: number;
  outliersTrimmed: number;
  confidence: Confidence;
  source: ApiSource;
  query: string;
  comps: RawComp[];
  nearMatches: Array<{
    title: string;
    price: number;
    url: string;
    reason: NearMatchReason;
  }>;
};

const allowedParams = ["player", "year", "brand", "set", "parallel", "grade"] as const;
const entriesPerPage = "25";

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
  const fields = normalizeFields(
    Object.fromEntries(
      allowedParams.map((key) => [key, cleanSearchPart(searchParams.get(key))]),
    ) as CardFields,
  );
  const query = buildSmartQuery(fields);

  if (query.length < 3) {
    return NextResponse.json(
      { error: "Comp search needs at least a player, year, or brand." },
      { status: 400 },
    );
  }

  try {
    let soldComps: RawComp[] = [];

    try {
      soldComps = await findFindingComps(query, "sold");
    } catch {
      soldComps = [];
    }

    const activeComps = soldComps.length < 3 ? await findActiveComps(query) : [];
    const allComps = dedupeComps([...soldComps, ...activeComps]);
    const soldCount = soldComps.length;
    const filtered = removeOutliers(allComps);
    const stats = priceStats(filtered.comps.map((comp) => comp.price));

    return NextResponse.json({
      avgPrice: stats.avgPrice,
      medianPrice: stats.medianPrice,
      lowPrice: stats.lowPrice,
      highPrice: stats.highPrice,
      samples: filtered.comps.length,
      totalFound: allComps.length,
      outliersTrimmed: filtered.nearMatches.length,
      confidence: confidenceFor(soldCount, allComps),
      source: sourceFor(soldComps, activeComps),
      query,
      comps: filtered.comps
        .sort((a, b) => {
          if (a.source !== b.source) return a.source === "sold" ? -1 : 1;
          return b.endDate.localeCompare(a.endDate);
        })
        .slice(0, 6),
      nearMatches: filtered.nearMatches,
    } satisfies CompResponse);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof EbayConfigError
            ? "eBay comps need EBAY_CLIENT_ID and EBAY_CLIENT_SECRET configured on the server."
            : "Unable to connect to eBay comps right now. Try again, or open the manual sold search below.",
      },
      { status: error instanceof EbayConfigError ? 501 : 502 },
    );
  }
}

function buildSmartQuery(fields: CardFields) {
  const brand = bestBrandPhrase(fields);
  const grade = fields.grade && fields.grade !== "Raw" ? fields.grade : "";
  const parallel = isBaseParallel(fields.parallel) ? "" : fields.parallel;
  const words = cleanQueryText(
    [fields.year, brand, fields.player, grade, parallel].filter(Boolean).join(" "),
  )
    .split(" ")
    .filter(Boolean);

  return words.slice(0, 7).join(" ");
}

function bestBrandPhrase(fields: CardFields) {
  const combined = `${fields.brand} ${fields.set}`.toLowerCase();

  if (combined.includes("bowman chrome")) return "Bowman Chrome";
  if (combined.includes("bowman draft")) return "Bowman Draft";
  if (combined.includes("topps chrome")) return "Topps Chrome";
  if (combined.includes("topps heritage")) return "Topps Heritage";
  if (combined.includes("upper deck")) return "Upper Deck";
  if (combined.includes("national treasures")) return "National Treasures";
  if (combined.includes("panini prizm")) return "Panini Prizm";

  return fields.brand || fields.set.split(" ").slice(0, 2).join(" ");
}

async function findFindingComps(query: string, source: CompSource) {
  const appId = process.env.EBAY_APP_ID || process.env.EBAY_CLIENT_ID;
  if (!appId) {
    throw new EbayConfigError();
  }

  const operationName = source === "sold" ? "findCompletedItems" : "findItemsAdvanced";
  const params = new URLSearchParams({
    "GLOBAL-ID": "EBAY-US",
    "OPERATION-NAME": operationName,
    "REST-PAYLOAD": "",
    "RESPONSE-DATA-FORMAT": "JSON",
    "SECURITY-APPNAME": appId,
    "SERVICE-VERSION": "1.0.0",
    categoryId: "212",
    keywords: query,
    "itemFilter(0).name": "ListingType",
    "itemFilter(0).value(0)": "AuctionWithBIN",
    "itemFilter(0).value(1)": "FixedPrice",
    "itemFilter(0).value(2)": "Auction",
    "paginationInput.entriesPerPage": entriesPerPage,
    sortOrder: "EndTimeSoonest",
  });

  if (source === "sold") {
    params.set("itemFilter(1).name", "SoldItemsOnly");
    params.set("itemFilter(1).value", "true");
  }

  const response = await fetch(
    `https://svcs.ebay.com/services/search/FindingService/v1?${params.toString()}`,
    { next: { revalidate: 60 } },
  );

  if (!response.ok) {
    throw new Error("eBay Finding API did not return results.");
  }

  const body = (await response.json()) as Record<string, Array<{
    ack?: string[];
    errorMessage?: Array<{ error?: Array<{ message?: string[] }> }>;
    searchResult?: Array<{ item?: FindingItem[] }>;
  }> | undefined>;
  const responseKey =
    source === "sold" ? "findCompletedItemsResponse" : "findItemsAdvancedResponse";
  const apiResponse = body[responseKey]?.[0];

  if (apiResponse?.ack?.[0] === "Failure") {
    throw new Error(apiResponse.errorMessage?.[0]?.error?.[0]?.message?.[0] ?? "eBay Finding API failed.");
  }

  const items = apiResponse?.searchResult?.[0]?.item ?? [];

  return items.map((item) => toComp(item, source)).filter(isRawComp);
}

async function findActiveComps(query: string) {
  try {
    return await findFindingComps(query, "active");
  } catch {
    return findBrowseActiveComps(query);
  }
}

async function findBrowseActiveComps(query: string) {
  const token = await getEbayAppToken();
  const params = new URLSearchParams({
    category_ids: "212",
    limit: entriesPerPage,
    q: query,
  });
  const response = await fetch(
    `https://api.ebay.com/buy/browse/v1/item_summary/search?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      },
      next: { revalidate: 60 },
    },
  );

  if (!response.ok) {
    throw new Error("eBay Browse API did not return results.");
  }

  const body = (await response.json()) as { itemSummaries?: BrowseItem[] };
  return (body.itemSummaries ?? []).map(toBrowseComp).filter(isRawComp);
}

function toBrowseComp(item: BrowseItem): RawComp | null {
  const price = Number(item.price?.value);
  const title = item.title?.trim() ?? "";
  const url = item.itemWebUrl ?? "";

  if (!title || !url || !Number.isFinite(price) || price <= 0) return null;

  return {
    condition: item.condition ?? "",
    endDate: item.itemEndDate ?? item.itemCreationDate ?? "",
    imageUrl: item.image?.imageUrl ?? "",
    price: Math.round(price * 100) / 100,
    source: "active",
    title,
    url,
  };
}

function toComp(item: FindingItem, source: CompSource): RawComp | null {
  const price = Number(
    item.sellingStatus?.[0]?.soldPrice?.[0]?.__value__ ??
      item.sellingStatus?.[0]?.convertedCurrentPrice?.[0]?.__value__ ??
      item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__,
  );
  const title = item.title?.[0]?.trim() ?? "";
  const url = item.viewItemURL?.[0] ?? "";

  if (!title || !url || !Number.isFinite(price) || price <= 0) return null;

  return {
    condition: item.condition?.[0]?.conditionDisplayName?.[0] ?? "",
    endDate: item.listingInfo?.[0]?.endTime?.[0] ?? "",
    imageUrl: item.galleryURL?.[0] ?? "",
    price: Math.round(price * 100) / 100,
    source,
    title,
    url,
  };
}

function removeOutliers(comps: RawComp[]) {
  if (comps.length < 4) {
    return { comps, nearMatches: [] };
  }

  const prices = comps.map((comp) => comp.price).sort((a, b) => a - b);
  const q1 = prices[Math.floor(comps.length * 0.25)];
  const q3 = prices[Math.floor(comps.length * 0.75)];
  const iqr = q3 - q1;
  const low = q1 - 1.5 * iqr;
  const high = q3 + 1.5 * iqr;
  const kept: RawComp[] = [];
  const nearMatches: CompResponse["nearMatches"] = [];

  for (const comp of comps) {
    if (comp.price < low || comp.price > high) {
      nearMatches.push({
        title: comp.title,
        price: comp.price,
        url: comp.url,
        reason: comp.price > high ? "outlier_high" : "outlier_low",
      });
    } else {
      kept.push(comp);
    }
  }

  return { comps: kept, nearMatches };
}

function priceStats(prices: number[]) {
  if (!prices.length) {
    return {
      avgPrice: 0,
      highPrice: 0,
      lowPrice: 0,
      medianPrice: 0,
    };
  }

  const sorted = [...prices].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];
  const total = prices.reduce((sum, price) => sum + price, 0);

  return {
    avgPrice: roundMoney(total / prices.length),
    highPrice: Math.max(...prices),
    lowPrice: Math.min(...prices),
    medianPrice: roundMoney(median),
  };
}

function confidenceFor(soldCount: number, comps: RawComp[]): Confidence {
  if (soldCount >= 8) return "high";
  if (soldCount >= 3) return "medium";
  if (comps.length > 0) return "low";
  return "low";
}

function sourceFor(soldComps: RawComp[], activeComps: RawComp[]): ApiSource {
  if (soldComps.length > 0 && activeComps.length > 0) return "mixed";
  if (soldComps.length > 0) return "sold";
  return "active";
}

function cleanSearchPart(value: string | null) {
  return cleanQueryText(value ?? "").slice(0, 80);
}

function cleanQueryText(value: string) {
  return value
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, " ")
    .replace(/[^\w\s./#-]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !hypeWords.has(word.toLowerCase()))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeFields(fields: CardFields): CardFields {
  return {
    brand: normalizeEmptyish(fields.brand),
    grade: normalizeEmptyish(fields.grade),
    parallel: normalizeEmptyish(fields.parallel),
    player: cleanPlayer(fields.player),
    set: normalizeEmptyish(fields.set),
    year: normalizeEmptyish(fields.year),
  };
}

function normalizeEmptyish(value: string) {
  const clean = cleanQueryText(value);
  return /^(none|n\/a|na|null|undefined|not specified|unknown|base)$/i.test(clean)
    ? ""
    : clean;
}

function cleanPlayer(value: string) {
  return cleanQueryText(value)
    .replace(/\b(rc|rookie|auto|autograph|patch|refractor|chrome|black|base)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isBaseParallel(value: string) {
  return !value || /^(base|none|n\/a|na|not specified|unknown)$/i.test(value);
}

function dedupeComps(comps: RawComp[]) {
  const seen = new Set<string>();
  const deduped: RawComp[] = [];

  for (const comp of comps) {
    const key = comp.url || `${comp.title}-${comp.price}-${comp.source}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(comp);
  }

  return deduped;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function isRawComp(comp: RawComp | null): comp is RawComp {
  return comp !== null;
}

const hypeWords = new Set([
  "rare",
  "hot",
  "invest",
  "investment",
  "fire",
  "gem",
  "mint",
  "wow",
  "ssp",
  "sp",
  "free",
  "ship",
  "shipping",
  "must",
  "see",
  "look",
  "l@@k",
]);
