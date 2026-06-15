import { NextResponse } from "next/server";
import { EbayConfigError, getEbayAppToken } from "@/lib/ebay";
import { checkRateLimit, requestIdentifier } from "@/lib/rate-limit";

type CompSource = "active";
type ApiSource = "active";
type Confidence = "high" | "medium" | "low";
type NearMatchReason = "outlier_high" | "outlier_low";

type CardFields = {
  brand: string;
  cardNumber: string;
  grade: string;
  parallel: string;
  player: string;
  set: string;
  tags: string;
  year: string;
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
  filteredOut?: number;
};

const allowedParams = ["player", "year", "brand", "set", "cardNumber", "parallel", "grade", "tags"] as const;
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
    const foundActive = await findBrowseActiveComps(query);
    const filteredActive = filterRelevantComps(foundActive, fields);
    const allComps = dedupeComps(filteredActive.comps);
    const filtered = removeOutliers(allComps);
    const stats = priceStats(filtered.comps.map((comp) => comp.price));

    return NextResponse.json({
      avgPrice: stats.avgPrice,
      medianPrice: stats.medianPrice,
      lowPrice: stats.lowPrice,
      highPrice: stats.highPrice,
      samples: filtered.comps.length,
      totalFound: allComps.length + filteredActive.filteredOut,
      outliersTrimmed: filtered.nearMatches.length,
      confidence: confidenceFor(allComps),
      source: "active",
      query,
      filteredOut: filteredActive.filteredOut,
      comps: filtered.comps
        .sort((a, b) => b.endDate.localeCompare(a.endDate))
        .slice(0, 6),
      nearMatches: filtered.nearMatches,
    } satisfies CompResponse);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof EbayConfigError
            ? "eBay comps need EBAY_CLIENT_ID and EBAY_CLIENT_SECRET configured on the server."
            : "Unable to connect to eBay market listings right now. Try again, or open the manual eBay search below.",
      },
      { status: error instanceof EbayConfigError ? 501 : 502 },
    );
  }
}

function buildSmartQuery(fields: CardFields) {
  const identity = bestIdentityPhrase(fields);
  const grade = fields.grade && fields.grade !== "Raw" ? fields.grade : "";
  const parallel = isBaseParallel(fields.parallel) ? "" : fields.parallel;
  const cardNumber = normalizeCardNumber(fields.cardNumber);
  const baseHint = isBaseCard(fields) && !cardNumber ? "Base" : "";
  const words = cleanQueryText(
    [fields.year, identity, fields.player, cardNumber || baseHint, grade, parallel]
      .filter(Boolean)
      .join(" "),
  )
    .split(" ")
    .filter(Boolean);

  return words.slice(0, 7).join(" ");
}

function bestIdentityPhrase(fields: CardFields) {
  const set = fields.set.replace(/\b(19[8-9]\d|20[0-3]\d)\b/g, "").trim();
  const combined = `${fields.brand} ${set}`.toLowerCase();

  if (combined.includes("topps chrome black")) return "Topps Chrome Black";
  if (combined.includes("bowman chrome")) return "Bowman Chrome";
  if (combined.includes("bowman draft")) return "Bowman Draft";
  if (combined.includes("topps chrome")) return "Topps Chrome";
  if (combined.includes("topps heritage")) return "Topps Heritage";
  if (combined.includes("upper deck")) return "Upper Deck";
  if (combined.includes("national treasures")) return "National Treasures";
  if (combined.includes("panini prizm")) return "Panini Prizm";

  return fields.brand || set.split(" ").slice(0, 3).join(" ");
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

function filterRelevantComps(comps: RawComp[], fields: CardFields) {
  const filtered = comps.filter((comp) => isRelevantComp(comp.title, fields));

  return {
    comps: filtered,
    filteredOut: comps.length - filtered.length,
  };
}

function isRelevantComp(title: string, fields: CardFields) {
  const lowerTitle = title.toLowerCase();
  const normalizedTitle = normalizeForMatch(title);
  const playerTokens = normalizeForMatch(fields.player)
    .split(" ")
    .filter((token) => token.length > 1);
  const setTokens = identityTokens(fields);
  const cardNumber = normalizeCardNumber(fields.cardNumber);

  if (/\b(lot|lots|2 card|2-card|two card|pair|bundle)\b/i.test(title)) return false;
  if (playerTokens.length && !playerTokens.every((token) => normalizedTitle.includes(token))) {
    return false;
  }
  if (fields.year && !normalizedTitle.includes(fields.year)) return false;
  if (setTokens.length && !setTokens.every((token) => normalizedTitle.includes(token))) {
    return false;
  }
  if (cardNumber && !titleHasCardNumber(normalizedTitle, cardNumber)) return false;

  if (isBaseCard(fields) && hasBaseMismatchSignal(title, normalizedTitle)) {
    return false;
  }
  if (isBaseParallel(fields.parallel) && hasNonBaseParallel(normalizedTitle)) {
    return false;
  }
  if (!hasTag(fields, "Auto") && hasAutoSignal(normalizedTitle)) return false;
  if (!hasTag(fields, "Patch") && hasPatchSignal(normalizedTitle)) {
    return false;
  }
  if (!hasTag(fields, "Numbered") && hasNumberedSignal(lowerTitle)) return false;

  if (!isBaseParallel(fields.parallel)) {
    const parallelTokens = normalizeForMatch(fields.parallel)
      .split(" ")
      .filter((token) => token.length > 1 && !/^\d+$/.test(token));

    if (parallelTokens.length && !parallelTokens.every((token) => normalizedTitle.includes(token))) {
      return false;
    }
  }

  return true;
}

function isBaseCard(fields: CardFields) {
  return (
    isBaseParallel(fields.parallel) &&
    !hasTag(fields, "Auto") &&
    !hasTag(fields, "Patch") &&
    !hasTag(fields, "Numbered")
  );
}

function identityTokens(fields: CardFields) {
  const identity = bestIdentityPhrase(fields);
  return normalizeForMatch(identity)
    .split(" ")
    .filter((token) => token.length > 1 && token !== fields.year);
}

function normalizeForMatch(value: string) {
  return value
    .toLowerCase()
    .replace(/#/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleHasCardNumber(normalizedTitle: string, cardNumber: string) {
  const cleanNumber = normalizeCardNumber(cardNumber);
  if (!cleanNumber) return true;

  const escaped = cleanNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s)${escaped}(\\s|$)`, "i").test(normalizedTitle);
}

function hasNonBaseParallel(normalizedTitle: string) {
  return /\b(superfractor|refractor|mojo|silver|gold|blue|red|orange|purple|pink|green|aqua|holo|rainbow|cracked ice|shimmer|disco|hyper|sepia|xfractor|x fractor|speckle|wave|lava|sapphire|atomic)\b/.test(
    normalizedTitle,
  );
}

function hasAutoSignal(normalizedTitle: string) {
  return /\b(auto|autograph|signed|redemption|cba|certified autograph)\b/.test(normalizedTitle);
}

function hasPatchSignal(normalizedTitle: string) {
  return /\b(patch|patchwork|rpa|relic|jersey|memorabilia|materials)\b/.test(normalizedTitle);
}

function hasNumberedSignal(lowerTitle: string) {
  return /\b1\s*of\s*1\b|\b1\/1\b|\/\s*\d{1,4}\b|\bnumbered\b|\bserial numbered\b|\bprinting plate\b|\bsuperfractor\b/.test(
    lowerTitle,
  );
}

function hasBaseMismatchSignal(rawTitle: string, normalizedTitle: string) {
  return (
    hasInsertSignal(normalizedTitle) ||
    hasPatchSignal(normalizedTitle) ||
    hasInsertCardCode(rawTitle) ||
    hasNumberedSignal(rawTitle.toLowerCase())
  );
}

function hasInsertSignal(normalizedTitle: string) {
  return /\b(patchwork|case hit|casehit|ssp|short print|sp|insert|variation|image variation|parallel|prospect power up|spotlight|bowman scouts|scouts top|top 100|major league material|modern prospects|rookie of the year favorites|sights on september|bowman ai|chrome prospects)\b/.test(
    normalizedTitle,
  );
}

function hasInsertCardCode(rawTitle: string) {
  return /#\s*[a-z]{1,6}-\d{1,5}\b|\b[a-z]{1,6}-\d{1,5}\b/i.test(rawTitle);
}

function hasTag(fields: CardFields, tag: string) {
  return fields.tags
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .includes(tag.toLowerCase());
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

function confidenceFor(comps: RawComp[]): Confidence {
  if (comps.length >= 8) return "high";
  if (comps.length >= 3) return "medium";
  return "low";
}

function cleanSearchPart(value: string | null) {
  return cleanQueryText(value ?? "").slice(0, 80);
}

function normalizeCardNumber(value: string) {
  return cleanQueryText(value)
    .replace(/^#+/, "")
    .replace(/\s+/g, "")
    .toLowerCase();
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
    cardNumber: normalizeCardNumber(normalizeEmptyish(fields.cardNumber)),
    grade: normalizeEmptyish(fields.grade),
    parallel: normalizeEmptyish(fields.parallel),
    player: cleanPlayer(fields.player),
    set: normalizeEmptyish(fields.set),
    tags: normalizeEmptyish(fields.tags),
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
