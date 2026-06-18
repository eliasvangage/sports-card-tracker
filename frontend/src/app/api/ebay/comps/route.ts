import { NextResponse } from "next/server";
import { EbayConfigError, getEbayAppToken } from "@/lib/ebay";
import { checkRateLimit, requestIdentifier } from "@/lib/rate-limit";

type CompSource = "active";
type ApiSource = "active";
type Confidence = "high" | "medium" | "low";
type NearMatchReason = "outlier_high" | "outlier_low" | "parallel_mismatch";

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
const entriesPerPage = "50";

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
    const queries = buildSearchQueries(fields);
    const foundActive = dedupeComps(
      (await Promise.all(queries.map((searchQuery) => findBrowseActiveComps(searchQuery)))).flat(),
    );
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
      query: queries.join(" | "),
      filteredOut: filteredActive.filteredOut,
      comps: filtered.comps
        .sort((a, b) => b.endDate.localeCompare(a.endDate))
        .slice(0, 6),
      nearMatches: [...filtered.nearMatches, ...filteredActive.nearMatches].slice(0, 12),
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
  const autoHint = hasTag(fields, "Auto") ? "Auto" : "";
  const words = cleanQueryText(
    [fields.year, identity, fields.player, cardNumber || baseHint, autoHint, grade, parallel]
      .filter(Boolean)
      .join(" "),
  )
    .split(" ")
    .filter(Boolean);

  return words.slice(0, 7).join(" ");
}

function buildSearchQueries(fields: CardFields) {
  return Array.from(
    new Set(
      [
        buildSmartQuery(fields),
        buildFallbackQuery(fields),
        buildCompactNumberQuery(fields),
        buildVariantQuery(fields),
      ].filter((searchQuery) => searchQuery.length >= 3),
    ),
  ).slice(0, 4);
}

function buildFallbackQuery(fields: CardFields) {
  const identity = compactIdentityPhrase(fields);
  const keyParallel = keyParallelPhrase(fields.parallel);
  const autoHint = hasTag(fields, "Auto") ? "Auto" : "";
  const words = cleanQueryText(
    [fields.year, identity, fields.player, autoHint, keyParallel].filter(Boolean).join(" "),
  )
    .split(" ")
    .filter(Boolean);

  return words.slice(0, 7).join(" ");
}

function buildCompactNumberQuery(fields: CardFields) {
  const identity = compactIdentityPhrase(fields);
  const cardNumber = normalizeCardNumber(fields.cardNumber);
  const words = cleanQueryText(
    [fields.year, identity, fields.player, cardNumber].filter(Boolean).join(" "),
  )
    .split(" ")
    .filter(Boolean);

  return words.slice(0, 7).join(" ");
}

function buildVariantQuery(fields: CardFields) {
  const identity = compactIdentityPhrase(fields);
  const variant = distinctiveParallelTokens(fields.parallel).join(" ");
  const autoHint = hasTag(fields, "Auto") ? "Auto" : "";
  const words = cleanQueryText(
    [fields.year, identity, fields.player, autoHint, variant].filter(Boolean).join(" "),
  )
    .split(" ")
    .filter(Boolean);

  return words.slice(0, 7).join(" ");
}

function bestIdentityPhrase(fields: CardFields) {
  const set = fields.set.replace(/\b(19[8-9]\d|20[0-3]\d)\b/g, "").trim();
  const combined = `${fields.brand} ${set}`.toLowerCase();

  if (combined.includes("topps chrome black")) return "Topps Chrome Black";
  if (combined.includes("topps chrome ufc")) return "Topps Chrome UFC";
  if (combined.includes("topps now")) return "Topps Now";
  if (combined.includes("panini prizm club world cup")) return "Panini Prizm Club World Cup";
  if (combined.includes("club world cup")) return "Panini Prizm Club World Cup";
  if (combined.includes("bowman sterling")) return "Bowman Sterling";
  if (combined.includes("upper deck mvp")) return "Upper Deck MVP";
  if (combined.includes("bowman chrome mega box")) return "Bowman Chrome Mega Box";
  if (combined.includes("bowman chrome prospects")) return "Bowman Chrome Prospects";
  if (combined.includes("bowman chrome")) return "Bowman Chrome";
  if (combined.includes("bowman draft")) return "Bowman Draft";
  if (combined.includes("topps chrome")) return "Topps Chrome";
  if (combined.includes("topps heritage")) return "Topps Heritage";
  if (combined.includes("upper deck")) return "Upper Deck";
  if (combined.includes("national treasures")) return "National Treasures";
  if (combined.includes("panini prizm")) return "Panini Prizm";

  return fields.brand || set.split(" ").slice(0, 3).join(" ");
}

function compactIdentityPhrase(fields: CardFields) {
  const identity = bestIdentityPhrase(fields);

  if (identity === "Bowman Chrome Mega Box") return "Bowman Chrome";
  return identity;
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
  const filtered: RawComp[] = [];
  const nearMatches: CompResponse["nearMatches"] = [];

  for (const comp of comps) {
    if (isRelevantComp(comp.title, fields)) {
      filtered.push(comp);
    } else if (isParallelNearMatch(comp.title, fields)) {
      nearMatches.push({
        title: comp.title,
        price: comp.price,
        url: comp.url,
        reason: "parallel_mismatch",
      });
    }
  }

  return {
    comps: filtered,
    filteredOut: comps.length - filtered.length - nearMatches.length,
    nearMatches,
  };
}

function isRelevantComp(title: string, fields: CardFields, options: { allowParallelMismatch?: boolean } = {}) {
  const lowerTitle = title.toLowerCase();
  const normalizedTitle = normalizeForMatch(title);
  const playerTokens = normalizeForMatch(fields.player)
    .split(" ")
    .filter((token) => token.length > 1);
  const setTokens = identityTokens(fields);
  const cardNumber = normalizeCardNumber(fields.cardNumber);

  if (hasMultiCardSignal(title, normalizedTitle)) return false;
  if (playerTokens.length && !playerTokens.every((token) => normalizedTitle.includes(token))) {
    return false;
  }
  if (fields.year && !normalizedTitle.includes(fields.year)) return false;
  if (setTokens.length && !setTokens.every((token) => normalizedTitle.includes(token))) {
    return false;
  }
  if (cardCodeFamilyConflict(normalizedTitle, cardNumber)) {
    return false;
  }
  if (cardNumber && hasMismatchedInsertCardCode(title, cardNumber)) {
    return false;
  }
  if (cardNumber && !titleHasCardNumber(normalizedTitle, cardNumber) && hasCardNumberSignal(title)) {
    return false;
  }

  if (isBaseCard(fields) && hasBaseMismatchSignal(title, normalizedTitle, cardNumber)) {
    return false;
  }
  if (isBaseParallel(fields.parallel) && hasNonBaseParallel(normalizedTitle)) {
    return false;
  }
  if (hasTag(fields, "Auto") && !hasAutoSignal(normalizedTitle)) {
    return false;
  }
  if (!hasTag(fields, "Auto") && hasAutoSignal(normalizedTitle)) return false;
  if (!hasTag(fields, "Patch") && hasPatchSignal(normalizedTitle)) {
    return false;
  }
  if (hasTag(fields, "Numbered") && !titleMatchesPrintRun(title, fields.parallel)) {
    return false;
  }
  if (!hasTag(fields, "Numbered") && hasNumberedSignal(lowerTitle)) return false;

  if (!isBaseParallel(fields.parallel)) {
    if (!options.allowParallelMismatch && !titleMatchesParallel(normalizedTitle, fields.parallel)) {
      return false;
    }
  }

  return true;
}

function isParallelNearMatch(title: string, fields: CardFields) {
  if (isBaseParallel(fields.parallel)) return false;

  const normalizedTitle = normalizeForMatch(title);
  return !titleMatchesParallel(normalizedTitle, fields.parallel) &&
    isRelevantComp(title, fields, { allowParallelMismatch: true });
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

  const numberTokens = normalizeForMatch(cleanNumber).split(" ").filter(Boolean);
  if (!numberTokens.length) return true;

  const escaped = numberTokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`(^|\\s)${escaped.join("\\s+")}(\\s|$)`, "i").test(normalizedTitle);
}

function cardCodeFamilyConflict(normalizedTitle: string, cardNumber: string) {
  const code = normalizeCardNumber(cardNumber).toLowerCase();
  if (!code) return false;
  if (titleHasCardNumber(normalizedTitle, code)) return false;

  if (code.startsWith("bst-")) {
    return !normalizedTitle.includes("sterling") || normalizedTitle.includes("mega box");
  }
  if (code.startsWith("bcp-")) {
    return normalizedTitle.includes("sterling") || normalizedTitle.includes("mega box");
  }
  if (code.startsWith("cpa-")) {
    return !normalizedTitle.includes("auto") && !normalizedTitle.includes("autograph") && !normalizedTitle.includes("cpa");
  }
  if (code.startsWith("bav-")) {
    return !normalizedTitle.includes("ufc") || (!normalizedTitle.includes("auto") && !normalizedTitle.includes("autograph"));
  }
  if (code.startsWith("jp")) {
    return !normalizedTitle.includes("topps now") && !normalizedTitle.includes("wbc") && !normalizedTitle.includes("team japan");
  }

  return false;
}

function hasCardNumberSignal(rawTitle: string) {
  return /#\s*[a-z0-9]{1,8}(?:-[a-z0-9]{1,8})?|\bcard\s*(?:no\.?|number|#)?\s*[a-z0-9]{1,8}(?:-[a-z0-9]{1,8})?\b/i.test(
    rawTitle,
  );
}

function titleMatchesParallel(normalizedTitle: string, parallel: string) {
  const titleTokens = new Set(normalizedTitle.split(" ").filter(Boolean));
  const tokens = distinctiveParallelTokens(parallel);
  const conflicts = conflictingParallelTokens(parallel);

  if (conflicts.some((token) => titleTokens.has(token))) return false;
  return !tokens.length || tokens.every((token) => titleTokens.has(token));
}

function keyParallelPhrase(parallel: string) {
  const normalized = normalizeForMatch(parallel);

  if (normalized.includes("red") && normalized.includes("variation")) return "Red Variation";
  if (normalized.includes("rookie") && normalized.includes("variation")) return "Rookie Variation";
  if (normalized.includes("mega") && normalized.includes("mojo")) return "Mega Mojo";
  if (normalized.includes("silver") && normalized.includes("glitter")) return "Silver Glitter";
  if (normalized.includes("green") && normalized.includes("lava")) return "Green Lava";
  if (normalized.includes("pink") && normalized.includes("holo")) return "Pink Holo";
  if (normalized.includes("speckle")) return "Speckle";
  if (normalized.includes("sparkle")) return "Sparkle";
  if (normalized.includes("green")) return "Green";
  if (normalized.includes("laser")) return "Laser";
  if (normalized.includes("mojo")) return "Mojo";
  if (normalized.includes("eastern stars")) return "Eastern Stars";
  if (normalized.includes("western stars")) return "Western Stars";
  if (normalized.includes("red")) return "Red";
  if (normalized.includes("refractor")) return "Refractor";

  return parallel;
}

function distinctiveParallelTokens(parallel: string) {
  const normalized = normalizeForMatch(parallel);
  const tokens = new Set<string>();

  if (normalized.includes("red") && (normalized.includes("variation") || normalized.includes("variations"))) {
    return ["red"];
  }
  if (normalized.includes("mega")) tokens.add("mega");
  if (normalized.includes("mojo")) tokens.add("mojo");
  if (normalized.includes("glitter")) tokens.add("glitter");
  if (normalized.includes("lava")) tokens.add("lava");
  if (normalized.includes("sapphire")) tokens.add("sapphire");
  if (normalized.includes("foil")) tokens.add("foil");
  if (normalized.includes("holo")) tokens.add("holo");
  if (normalized.includes("prizm")) tokens.add("prizm");
  if (normalized.includes("red")) tokens.add("red");
  if (normalized.includes("silver")) tokens.add("silver");
  if (normalized.includes("green")) tokens.add("green");
  if (normalized.includes("gold")) tokens.add("gold");
  if (normalized.includes("blue")) tokens.add("blue");
  if (normalized.includes("pink")) tokens.add("pink");
  if (normalized.includes("orange")) tokens.add("orange");
  if (normalized.includes("purple")) tokens.add("purple");
  if (normalized.includes("aqua")) tokens.add("aqua");
  if (normalized.includes("laser")) tokens.add("laser");
  if (normalized.includes("speckle")) tokens.add("speckle");
  if (normalized.includes("sparkle")) tokens.add("sparkle");
  if (normalized.includes("cracked") && normalized.includes("ice")) {
    tokens.add("cracked");
    tokens.add("ice");
  }
  const printRun = normalized.match(/\b(\d{1,5})\b/)?.[1];
  if (printRun && Number(printRun) < 10000) tokens.add(printRun);
  if (normalized.includes("variation") || normalized.includes("variations")) tokens.add("variation");
  if (normalized.includes("logo")) tokens.add("logo");
  if (normalized.includes("eastern")) tokens.add("eastern");
  if (normalized.includes("western")) tokens.add("western");

  if (!tokens.size && normalized.includes("refractor")) tokens.add("refractor");
  return Array.from(tokens);
}

function conflictingParallelTokens(parallel: string) {
  const normalized = normalizeForMatch(parallel);
  const conflicts = new Set<string>();

  if (!normalized.includes("mojo")) conflicts.add("mojo");
  if (!normalized.includes("glitter")) conflicts.add("glitter");
  if (!normalized.includes("lava")) conflicts.add("lava");
  if (!normalized.includes("sapphire")) conflicts.add("sapphire");
  if (!normalized.includes("foil")) conflicts.add("foil");
  if (!normalized.includes("holo")) conflicts.add("holo");
  if (!normalized.includes("laser")) conflicts.add("laser");
  if (!normalized.includes("speckle")) conflicts.add("speckle");
  if (!normalized.includes("sparkle")) conflicts.add("sparkle");
  if (!normalized.includes("shield")) conflicts.add("shield");
  if (!normalized.includes("variation") && !normalized.includes("variations")) {
    conflicts.add("variation");
    conflicts.add("variations");
  }
  if (!normalized.includes("red")) conflicts.add("red");
  if (!normalized.includes("green")) conflicts.add("green");
  if (!normalized.includes("gold")) conflicts.add("gold");
  if (!normalized.includes("blue")) conflicts.add("blue");
  if (!normalized.includes("pink")) conflicts.add("pink");
  if (!normalized.includes("orange")) conflicts.add("orange");
  if (!normalized.includes("purple")) conflicts.add("purple");
  if (!normalized.includes("aqua")) conflicts.add("aqua");

  return Array.from(conflicts);
}

function hasMultiCardSignal(rawTitle: string, normalizedTitle: string) {
  if (/\b(lot|lots|2 card|2-card|two card|pair|bundle|with|plus)\b/i.test(rawTitle)) {
    return true;
  }

  if (/\s[&+]\s/.test(rawTitle)) return true;
  if (/\b(bonus|bonus card|multi card)\b/.test(normalizedTitle)) return true;

  return false;
}

function hasNonBaseParallel(normalizedTitle: string) {
  return /\b(superfractor|refractor|mojo|silver|glitter|gold|blue|red|orange|purple|pink|green|aqua|holo|foil|rainbow|cracked ice|shimmer|disco|hyper|sepia|xfractor|x fractor|speckle|sparkle|wave|lava|sapphire|atomic|variation|logo|laser)\b/.test(
    normalizedTitle,
  );
}

function hasAutoSignal(normalizedTitle: string) {
  return /\b(auto|autograph|signed|redemption|cba|cpa|certified autograph)\b/.test(normalizedTitle);
}

function hasPatchSignal(normalizedTitle: string) {
  return /\b(patch|patchwork|rpa|relic|jersey|memorabilia|materials)\b/.test(normalizedTitle);
}

function hasNumberedSignal(lowerTitle: string) {
  return /\b1\s*of\s*1\b|\b1\/1\b|\/\s*\d{1,4}\b|\bnumbered\b|\bserial numbered\b|\bprinting plate\b|\bsuperfractor\b/.test(
    lowerTitle,
  );
}

function titleMatchesPrintRun(rawTitle: string, parallel: string) {
  const printRun = parallel.match(/\/\s*(\d{1,5})\b/)?.[1];
  if (!printRun) return true;

  return new RegExp(`(?:/|\\bof\\s*)${printRun}\\b|\\b\\d+\\s*/\\s*${printRun}\\b`, "i").test(rawTitle);
}

function hasBaseMismatchSignal(rawTitle: string, normalizedTitle: string, cardNumber: string) {
  return (
    hasInsertSignal(normalizedTitle) ||
    hasPatchSignal(normalizedTitle) ||
    hasMismatchedInsertCardCode(rawTitle, cardNumber) ||
    hasNumberedSignal(rawTitle.toLowerCase())
  );
}

function hasInsertSignal(normalizedTitle: string) {
  return /\b(patchwork|case hit|casehit|ssp|short print|sp|insert|variation|image variation|parallel|prospect power up|spotlight|bowman scouts|scouts top|top 100|major league material|modern prospects|rookie of the year favorites|sights on september|bowman ai|chrome prospects)\b/.test(
    normalizedTitle,
  );
}

function hasMismatchedInsertCardCode(rawTitle: string, cardNumber: string) {
  const insertCode = rawTitle.match(/#\s*([a-z0-9]{1,8}(?:-[a-z0-9]{1,8})?)\b|\b([a-z]{1,8}-[a-z0-9]{1,8})\b/i);
  if (!insertCode) return false;

  const foundCode = normalizeCardNumber(insertCode[1] ?? insertCode[2] ?? "");
  return Boolean(foundCode && (!cardNumber || foundCode !== cardNumber));
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
  const cardNumber = normalizeCardNumber(normalizeEmptyish(fields.cardNumber));
  const inferred = inferIdentityFromCardNumber(cardNumber);
  const brand = normalizeEmptyish(fields.brand);
  const set = normalizeEmptyish(fields.set);

  return {
    brand: inferred.brand || brand,
    cardNumber,
    grade: normalizeEmptyish(fields.grade),
    parallel: normalizeEmptyish(fields.parallel),
    player: cleanPlayer(fields.player),
    set: inferred.set || set,
    tags: normalizeEmptyish(fields.tags),
    year: normalizeEmptyish(fields.year),
  };
}

function inferIdentityFromCardNumber(cardNumber: string) {
  if (cardNumber.startsWith("bst-")) return { brand: "Bowman Sterling", set: "" };
  if (cardNumber.startsWith("bcp-")) return { brand: "Bowman Chrome", set: "Prospects" };
  if (cardNumber.startsWith("cpa-")) return { brand: "Bowman Chrome", set: "Prospect Autographs" };
  if (cardNumber.startsWith("bav-")) return { brand: "Topps Chrome", set: "UFC" };
  if (cardNumber.startsWith("jp")) return { brand: "Topps Now", set: "WBC" };

  return { brand: "", set: "" };
}

function normalizeEmptyish(value: string) {
  const clean = cleanQueryText(value);
  return /^(none|n\/a|na|null|undefined|not specified|unknown|base)$/i.test(clean)
    ? ""
    : clean;
}

function cleanPlayer(value: string) {
  return cleanQueryText(value)
    .replace(/\b(rc|rookie|auto|autograph|patch|refractor|chrome|black|base|prospect|prospects|1st|first)\b/gi, " ")
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
