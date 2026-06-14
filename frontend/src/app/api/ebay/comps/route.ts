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
  matchReasons?: string[];
  matchScore?: number;
  price: number;
  title: string;
  url: string;
};

const allowedParams = ["player", "year", "brand", "set", "parallel", "grade", "cardNumber"] as const;

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
  let dataSource = "sold";

  try {
    const soldResults = await findCompletedComps(query);
    const includeActiveFallback = searchParams.get("includeActive") === "1";
    comps = soldResults ?? (includeActiveFallback ? await findActiveComps(query) : []);
    dataSource = soldResults ? "sold" : includeActiveFallback ? "active" : "sold";
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

  const matchedComps = scoreAndFilterComps(comps, fields);
  const filteredComps = removeOutliers(matchedComps).slice(0, 10);
  const prices = filteredComps.map((comp) => comp.price);

  return NextResponse.json({
    avgPrice: averagePrice(prices),
    lowPrice: prices.length ? Math.min(...prices) : 0,
    highPrice: prices.length ? Math.max(...prices) : 0,
    minMatchScore: minimumMatchScore(fields),
    rejected: Math.max(0, comps.length - matchedComps.length),
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
    fields.cardNumber,
    fields.grade,
    fields.parallel.split(" ")[0],
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

async function findCompletedComps(query: string): Promise<CompResult[] | null> {
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
    .filter(isCompResult);

  return comps.length ? comps : null;
}

async function findActiveComps(query: string): Promise<CompResult[] | null> {
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
    .filter(isCompResult);

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

function scoreAndFilterComps(
  comps: CompResult[],
  fields: Record<(typeof allowedParams)[number], string>,
) {
  return comps
    .map((comp) => ({
      ...comp,
      ...scoreCompMatch(comp.title, fields),
    }))
    .filter(
      (comp) =>
        (comp.matchScore ?? 0) >= minimumMatchScore(fields) &&
        hasRequiredIdentity(comp.title, fields) &&
        !hasVariantConflict(comp.title, fields),
    )
    .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0) || a.price - b.price);
}

function hasRequiredIdentity(
  title: string,
  fields: Record<(typeof allowedParams)[number], string>,
) {
  if (!fields.cardNumber) return true;

  return cardNumberMatches(normalizeForMatch(title), normalizeCardNumber(fields.cardNumber));
}

function scoreCompMatch(
  title: string,
  fields: Record<(typeof allowedParams)[number], string>,
) {
  const normalizedTitle = normalizeForMatch(title);
  const reasons: string[] = [];
  let score = 0;
  let possible = 0;

  const playerTokens = keywordTokens(fields.player);
  if (playerTokens.length) {
    possible += 34;
    const playerHits = countHits(normalizedTitle, playerTokens);
    if (playerHits === playerTokens.length) {
      score += 34;
      reasons.push("player");
    } else if (playerHits >= Math.max(1, playerTokens.length - 1)) {
      score += 20;
      reasons.push("partial player");
    }
  }

  if (fields.year) {
    possible += 18;
    if (normalizedTitle.includes(normalizeForMatch(fields.year))) {
      score += 18;
      reasons.push("year");
    }
  }

  const brandTokens = brandMatchTokens(fields.brand);
  if (brandTokens.length) {
    possible += 16;
    if (brandTokens.some((token) => normalizedTitle.includes(token))) {
      score += 16;
      reasons.push("brand");
    }
  }

  const setTokens = keywordTokens(fields.set);
  if (setTokens.length) {
    possible += 12;
    const setHits = countHits(normalizedTitle, setTokens);
    if (setHits >= Math.min(2, setTokens.length)) {
      score += 12;
      reasons.push("set");
    } else if (setHits > 0) {
      score += 6;
      reasons.push("partial set");
    }
  }

  const parallelTokens = keywordTokens(fields.parallel).filter(
    (token) => !["base", "card"].includes(token),
  );
  if (parallelTokens.length) {
    possible += 10;
    if (parallelTokens.some((token) => normalizedTitle.includes(token))) {
      score += 10;
      reasons.push("parallel");
    }
  }

  if (fields.cardNumber) {
    possible += 6;
    const number = normalizeCardNumber(fields.cardNumber);
    if (number && cardNumberMatches(normalizedTitle, number)) {
      score += 6;
      reasons.push("card #");
    }
  }

  if (fields.grade && fields.grade !== "Raw") {
    possible += 10;
    if (normalizedTitle.includes(normalizeForMatch(fields.grade))) {
      score += 10;
      reasons.push("grade");
    }
  } else if (fields.grade === "Raw") {
    possible += 4;
    if (!/\b(psa|bgs|sgc|cgc|csg|hga)\b/.test(normalizedTitle)) {
      score += 4;
      reasons.push("raw");
    }
  }

  const matchScore = possible ? Math.round((score / possible) * 100) : 0;
  return { matchReasons: reasons, matchScore };
}

function hasVariantConflict(
  title: string,
  fields: Record<(typeof allowedParams)[number], string>,
) {
  const normalizedTitle = normalizeForMatch(title);
  const normalizedParallel = normalizeForMatch(fields.parallel);
  const titleSerial = title.match(/\/\s*(\d{2,4})\b/)?.[1] ?? "";
  const cardSerial = fields.parallel.match(/\/\s*(\d{2,4})\b/)?.[1] ?? "";

  if (titleSerial && cardSerial && titleSerial !== cardSerial) return true;
  if (titleSerial && !cardSerial) return true;

  const titleColors = variantColors.filter((color) =>
    new RegExp(`\\b${color}\\b`).test(normalizedTitle),
  );
  const cardColors = variantColors.filter((color) =>
    new RegExp(`\\b${color}\\b`).test(normalizedParallel),
  );

  return titleColors.some((color) => !cardColors.includes(color));
}

function minimumMatchScore(fields: Record<(typeof allowedParams)[number], string>) {
  if (fields.cardNumber || fields.parallel || (fields.grade && fields.grade !== "Raw")) {
    return 72;
  }

  if (fields.set) return 68;

  return 62;
}

function normalizeForMatch(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/#/g, " ")
    .replace(/[^a-z0-9/.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCardNumber(value: string) {
  return normalizeForMatch(value).replace(/\s+/g, "");
}

function cardNumberMatches(title: string, cardNumber: string) {
  const compactTitle = title.replace(/\s+/g, "");
  return compactTitle.includes(cardNumber) || compactTitle.includes(cardNumber.replace("-", ""));
}

function keywordTokens(value: string) {
  return normalizeForMatch(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !matchStopWords.has(token));
}

function brandMatchTokens(brand: string) {
  const normalized = normalizeForMatch(brand);
  const aliases: Record<string, string[]> = {
    bowman: ["bowman"],
    "bowman chrome": ["bowman chrome", "b chrome"],
    donruss: ["donruss"],
    mosaic: ["mosaic"],
    optic: ["optic"],
    panini: ["panini"],
    prizm: ["prizm"],
    select: ["select"],
    topps: ["topps"],
    "upper deck": ["upper deck", "ud"],
  };

  return aliases[normalized] ?? keywordTokens(brand);
}

function countHits(title: string, tokens: string[]) {
  return tokens.filter((token) => title.includes(token)).length;
}

const matchStopWords = new Set([
  "and",
  "card",
  "cards",
  "the",
  "a",
  "an",
  "of",
  "for",
  "with",
  "lot",
  "rare",
  "hot",
  "mint",
  "gem",
  "rookie",
  "rc",
]);

const variantColors = [
  "aqua",
  "black",
  "blue",
  "gold",
  "green",
  "orange",
  "pink",
  "purple",
  "red",
  "silver",
  "yellow",
];

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
