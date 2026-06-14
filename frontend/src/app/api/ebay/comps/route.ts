import { NextResponse } from "next/server";
import { EbayConfigError, getEbayAppToken } from "@/lib/ebay";
import { checkRateLimit, requestIdentifier } from "@/lib/rate-limit";

type EbayCompItem = {
  condition?: string;
  image?: {
    imageUrl?: string;
  };
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
  identity?: CompIdentity;
  matchReasons?: string[];
  matchScore?: number;
  price: number;
  title: string;
  url: string;
};

type CompIdentity = {
  cardNumber: string;
  isChromeBlack: boolean;
  isGraded: boolean;
  isRaw: boolean;
  playerHits: number;
  playerTokenCount: number;
  setHits: number;
  setTokenCount: number;
  variantConflicts: string[];
  yearHit: boolean;
};

const allowedParams = ["player", "year", "brand", "set", "parallel", "grade", "cardNumber"] as const;
const completedEntriesPerPage = "40";

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
    ) as Record<(typeof allowedParams)[number], string>,
  );
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
    const soldResults = await findCompletedComps(fields);
    const includeActiveFallback = searchParams.get("includeActive") === "1";
    const hasSoldResults = Array.isArray(soldResults) && soldResults.length > 0;
    comps = hasSoldResults
      ? soldResults
      : includeActiveFallback
        ? (await findActiveComps(query)) ?? soldResults
        : soldResults;
    dataSource = hasSoldResults ? "sold" : includeActiveFallback && comps?.length ? "active" : "sold";
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

  const rankedComps = rankComps(comps, fields);
  const matchedComps = rankedComps.filter((comp) => comp.verdict === "match");
  const nearComps = rankedComps.filter((comp) => comp.verdict === "near").slice(0, 4);
  const filteredComps = removeOutliers(matchedComps).slice(0, 10);
  const prices = filteredComps.map((comp) => comp.price);
  const lastSold = filteredComps
    .map((comp) => comp.endDate)
    .filter(Boolean)
    .sort()
    .at(-1) ?? "";

  return NextResponse.json({
    avgPrice: averagePrice(prices),
    confidence: marketConfidence(filteredComps, fields),
    lowPrice: prices.length ? Math.min(...prices) : 0,
    highPrice: prices.length ? Math.max(...prices) : 0,
    medianPrice: medianPrice(prices),
    minMatchScore: minimumMatchScore(fields),
    rejected: Math.max(0, comps.length - matchedComps.length),
    samples: filteredComps.length,
    lastSold,
    totalFound: comps.length,
    outliersTrimmed: Math.max(0, matchedComps.length - filteredComps.length),
    comps: filteredComps.slice(0, 5),
    nearComps,
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
    compactSet(fields.set, fields.year, fields.brand),
    fields.player,
    fields.cardNumber,
    significantParallel(fields.parallel),
    fields.grade && fields.grade !== "Raw" ? fields.grade : "",
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

function buildCompQueries(fields: Record<(typeof allowedParams)[number], string>) {
  const strict = buildCompQuery(fields);
  const withoutGrade = [
    fields.year,
    fields.brand,
    compactSet(fields.set, fields.year, fields.brand),
    fields.player,
    fields.cardNumber,
    significantParallel(fields.parallel),
  ].filter(Boolean).join(" ");
  const identity = [
    fields.year,
    fields.brand,
    compactSet(fields.set, fields.year, fields.brand),
    fields.player,
    fields.cardNumber,
  ].filter(Boolean).join(" ");
  const setFirst = [
    fields.year,
    fields.brand,
    exactSetPhrase(fields.set, fields.year, fields.brand),
    fields.player,
    fields.cardNumber,
  ].filter(Boolean).join(" ");
  const broad = [fields.year, fields.brand, exactSetPhrase(fields.set, fields.year, fields.brand), fields.player].filter(Boolean).join(" ");

  return Array.from(
    new Set([strict, setFirst, withoutGrade, identity, broad].map((item) => item.replace(/\s+/g, " ").trim()).filter(Boolean)),
  );
}

async function findCompletedComps(
  fields: Record<(typeof allowedParams)[number], string>,
): Promise<CompResult[] | null> {
  const appId = process.env.EBAY_APP_ID || process.env.EBAY_CLIENT_ID;
  if (!appId) return null;

  const allComps = new Map<string, CompResult>();

  for (const query of buildCompQueries(fields)) {
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
      "paginationInput.entriesPerPage": completedEntriesPerPage,
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

    for (const comp of comps) {
      allComps.set(`${comp.url}-${comp.price}`, comp);
    }

    if (allComps.size >= 12) break;
  }

  return Array.from(allComps.values());
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
    imageUrl: item.image?.imageUrl ?? "",
    price: Math.round(price * 100) / 100,
    title: item.title,
    url: item.itemWebUrl,
  };
}

function rankComps(
  comps: CompResult[],
  fields: Record<(typeof allowedParams)[number], string>,
) {
  return comps
    .map((comp) => {
      const identity = analyzeCompIdentity(comp.title, fields);
      const scoredComp = {
      ...comp,
      identity,
      ...scoreCompMatch(comp.title, fields),
      };

      return {
        ...scoredComp,
        verdict: compVerdict(scoredComp, fields),
      };
    })
    .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0) || a.price - b.price);
}

function compVerdict(
  comp: CompResult & { identity: CompIdentity },
  fields: Record<(typeof allowedParams)[number], string>,
) {
  const score = comp.matchScore ?? 0;
  const cardNumber = normalizeCardNumber(fields.cardNumber);
  const expectedSetTokens = importantSetTokens(fields.set, fields.year, fields.brand);
  const hasPlayer = comp.identity.playerHits >= Math.max(1, comp.identity.playerTokenCount - 1);
  const hasYear = !fields.year || comp.identity.yearHit;
  const hasSet =
    expectedSetTokens.length === 0 ||
    comp.identity.setHits >= Math.min(expectedSetTokens.length, fields.set.toLowerCase().includes("chrome black") ? 2 : 1);
  const hasCardNumber = !cardNumber || comp.identity.cardNumber === cardNumber;
  const gradeMatches =
    !fields.grade ||
    fields.grade === "Raw" ||
    normalizeForMatch(comp.title).includes(normalizeForMatch(fields.grade));
  const rawMatches =
    fields.grade !== "Raw" || comp.identity.isRaw;

  if (!hasPlayer || !hasYear) return "reject";
  if (cardNumber && comp.identity.cardNumber && comp.identity.cardNumber !== cardNumber) return "reject";
  if (cardNumber && !comp.identity.cardNumber) return "near";
  if (fields.set.toLowerCase().includes("chrome black") && !comp.identity.isChromeBlack) return "reject";
  if (!hasSet) return "near";
  if (comp.identity.variantConflicts.length) return "near";
  if (!gradeMatches || !rawMatches) return "near";
  if (score >= minimumMatchScore(fields) && hasCardNumber) return "match";

  return score >= nearMatchScore(fields) ? "near" : "reject";
}

function scoreCompMatch(title: string, fields: Record<(typeof allowedParams)[number], string>) {
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

  const setTokens = importantSetTokens(fields.set, fields.year, fields.brand);
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
    (token) => !["base", "card", "none"].includes(token),
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
      score += 16;
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

function minimumMatchScore(fields: Record<(typeof allowedParams)[number], string>) {
  if (fields.cardNumber || fields.parallel || (fields.grade && fields.grade !== "Raw")) {
    return 72;
  }

  if (fields.set) return 68;

  return 62;
}

function relaxedMinimumMatchScore(fields: Record<(typeof allowedParams)[number], string>) {
  if (fields.grade && fields.grade !== "Raw") return 64;
  if (fields.cardNumber || fields.parallel) return 60;
  return 56;
}

function nearMatchScore(fields: Record<(typeof allowedParams)[number], string>) {
  return fields.cardNumber || fields.set ? 54 : relaxedMinimumMatchScore(fields);
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
  const escaped = escapeRegExp(cardNumber.replace("-", ""));
  return new RegExp(`(?:^|[#\\s-])${escaped}(?:$|[^0-9])`).test(title);
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

function exactSetPhrase(value: string, year = "", brand = "") {
  const tokens = importantSetTokens(value, year, brand);
  return tokens.join(" ");
}

function compactSet(value: string, year = "", brand = "") {
  const tokens = importantSetTokens(value, year, brand);

  return tokens.slice(0, 3).join(" ");
}

function significantParallel(value: string) {
  const tokens = keywordTokens(value).filter(
    (token) => !["base", "card", "parallel", "refractor", "holo", "none"].includes(token),
  );

  return tokens[0] ?? "";
}

function importantSetTokens(value: string, year = "", brand = "") {
  const normalizedYear = normalizeForMatch(year);
  const normalizedBrand = normalizeForMatch(brand);

  return keywordTokens(value).filter(
    (token, index, tokens) =>
      !["base", "set"].includes(token) &&
      token !== normalizedYear &&
      token !== normalizedBrand &&
      !(token === "topps" && tokens.filter((item) => item === "topps").length > 1) &&
      !(token === "2026" && index > 0),
  );
}

function analyzeCompIdentity(
  title: string,
  fields: Record<(typeof allowedParams)[number], string>,
): CompIdentity {
  const normalizedTitle = normalizeForMatch(title);
  const playerTokens = keywordTokens(fields.player);
  const setTokens = importantSetTokens(fields.set, fields.year, fields.brand);
  const titleCardNumber = extractTitleCardNumber(title);
  const normalizedParallel = normalizeForMatch(fields.parallel);
  const titleSerial = title.match(/\/\s*(\d{2,4})\b/)?.[1] ?? "";
  const cardSerial = fields.parallel.match(/\/\s*(\d{2,4})\b/)?.[1] ?? "";
  const titleColors = variantColors.filter((color) =>
    new RegExp(`\\b${color}\\b`).test(normalizedTitle),
  );
  const cardColors = variantColors.filter((color) =>
    new RegExp(`\\b${color}\\b`).test(normalizedParallel),
  );
  const variantConflicts = [
    titleSerial && cardSerial && titleSerial !== cardSerial ? `/${titleSerial}` : "",
    ...titleColors.filter((color) => cardColors.length > 0 && !cardColors.includes(color)),
  ].filter(Boolean);

  return {
    cardNumber: titleCardNumber,
    isChromeBlack: /\bchrome\s+black\b/.test(normalizedTitle),
    isGraded: /\b(psa|bgs|sgc|cgc|csg|hga)\b/.test(normalizedTitle),
    isRaw: !/\b(psa|bgs|sgc|cgc|csg|hga)\b/.test(normalizedTitle),
    playerHits: countHits(normalizedTitle, playerTokens),
    playerTokenCount: playerTokens.length,
    setHits: countHits(normalizedTitle, setTokens),
    setTokenCount: setTokens.length,
    variantConflicts,
    yearHit: !fields.year || normalizedTitle.includes(normalizeForMatch(fields.year)),
  };
}

function extractTitleCardNumber(title: string) {
  return normalizeCardNumber(
    title.match(/#\s*([A-Z]{0,5}-?\d+[A-Z]?)\b/i)?.[1] ??
      title.match(/\b(?:card\s*(?:no\.?|number|#)\s*)([A-Z]{0,5}-?\d+[A-Z]?)\b/i)?.[1] ??
      "",
  );
}

function normalizeFields(fields: Record<(typeof allowedParams)[number], string>) {
  const normalized = { ...fields };
  normalized.cardNumber = normalizeCardNumber(normalized.cardNumber);
  normalized.parallel = normalizeEmptyish(normalized.parallel);
  normalized.grade = normalizeEmptyish(normalized.grade);
  normalized.set = dedupeSetText(normalized.set, normalized.year, normalized.brand);
  return normalized;
}

function normalizeEmptyish(value: string) {
  return /^(none|n\/a|na|null|undefined|not specified|unknown)$/i.test(value.trim())
    ? ""
    : value.trim();
}

function dedupeSetText(value: string, year: string, brand: string) {
  const tokens = normalizeForMatch(value).split(" ").filter(Boolean);
  const seen = new Set<string>();
  const result = tokens.filter((token) => {
    const key = `${token}:${token === normalizeForMatch(year) || token === normalizeForMatch(brand) ? "core" : "set"}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return result.join(" ");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function medianPrice(prices: number[]) {
  if (prices.length === 0) return 0;

  const sorted = [...prices].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];

  return Math.round(median * 100) / 100;
}

function marketConfidence(
  comps: Array<CompResult & { matchScore?: number }>,
  fields: Record<(typeof allowedParams)[number], string>,
) {
  if (!comps.length) return 0;

  const sampleScore = Math.min(35, comps.length * 7);
  const matchScore =
    comps.reduce((total, comp) => total + (comp.matchScore ?? 0), 0) / comps.length;
  const identityScore =
    fields.cardNumber && fields.set
      ? 30
      : fields.cardNumber || fields.set
        ? 22
        : 14;

  return Math.min(100, Math.round(sampleScore + matchScore * 0.35 + identityScore));
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
