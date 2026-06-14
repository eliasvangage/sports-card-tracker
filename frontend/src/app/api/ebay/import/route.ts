import { NextResponse } from "next/server";
import { EbayConfigError, getEbayAppToken } from "@/lib/ebay";
import { checkRateLimit, requestIdentifier } from "@/lib/rate-limit";
import { sportFromText, teamFromText } from "@/lib/card-taxonomy";

type EbayImage = {
  imageUrl?: string;
};

type EbayAspect = {
  name?: string;
  value?: string;
};

type EbayItem = {
  title?: string;
  itemWebUrl?: string;
  image?: EbayImage;
  additionalImages?: EbayImage[];
  buyingOptions?: string[];
  condition?: string;
  currentBidPrice?: {
    value?: string;
    currency?: string;
  };
  itemEndDate?: string;
  price?: {
    value?: string;
    currency?: string;
  };
  localizedAspects?: EbayAspect[];
};

type ParsedTitle = {
  brand: string;
  cardNumber: string;
  certNumber: string;
  grade: string;
  gradingCompany: string;
  parallel: string;
  player: string;
  set: string;
  sport: string;
  team: string;
  year: string;
};

type AspectFields = ParsedTitle;

type FieldSource = "ebay_aspects" | "title_parser";

type FieldResult = {
  confidence: number;
  source: FieldSource;
  value: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const listingUrl = searchParams.get("url") ?? "";
  const legacyItemId = extractEbayItemId(listingUrl);
  const marketplaceId = marketplaceFromUrl(listingUrl);
  const rateLimit = checkRateLimit({
    identifier: `ebay-import:${requestIdentifier(request)}`,
    limit: 12,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many eBay imports. Try again in a minute." },
      { status: 429 },
    );
  }

  if (!legacyItemId) {
    return NextResponse.json(
      { error: "Paste a valid eBay listing URL with an item number." },
      { status: 400 },
    );
  }

  let itemResponse: Response;

  try {
    const token = await getEbayAppToken();
    itemResponse = await fetch(
      `https://api.ebay.com/buy/browse/v1/item/get_item_by_legacy_id?legacy_item_id=${legacyItemId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-EBAY-C-MARKETPLACE-ID": marketplaceId,
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof EbayConfigError
            ? "eBay import is ready, but the server eBay credentials are not configured yet."
            : "Unable to connect to eBay right now.",
      },
      { status: error instanceof EbayConfigError ? 501 : 502 },
    );
  }

  if (!itemResponse.ok) {
    return NextResponse.json(
      { error: "eBay could not find that listing or the listing is unavailable." },
      { status: itemResponse.status },
    );
  }

  const item = (await itemResponse.json()) as EbayItem;
  const aspects = Object.fromEntries(
    (item.localizedAspects ?? [])
      .filter((aspect) => aspect.name && aspect.value)
      .map((aspect) => [aspect.name, aspect.value]),
  );
  const title = item.title ?? "";
  const buyingOptions = item.buyingOptions ?? [];
  const listingType = buyingOptions.includes("AUCTION")
    ? "Auction"
    : buyingOptions.includes("FIXED_PRICE")
      ? "Buy It Now"
      : "eBay listing";
  const priceValue = item.price?.value ?? item.currentBidPrice?.value ?? "";
  const priceLabel = item.currentBidPrice?.value ? "Current bid" : item.price?.value ? "Listing price" : "";
  const parsed = parseTitle(title);
  const aspectFields = extractFromAspects(aspects, title);
  const fieldConfidence = scoreFields(aspectFields, parsed);

  return NextResponse.json({
    title,
    imageUrl: item.image?.imageUrl ?? item.additionalImages?.[0]?.imageUrl ?? "",
    itemWebUrl: item.itemWebUrl ?? listingUrl,
    price: priceValue ? `$${priceValue}` : "",
    priceLabel,
    brand: fieldConfidence.brand.value,
    cardNumber: fieldConfidence.cardNumber.value,
    certNumber: fieldConfidence.certNumber.value,
    fieldConfidence,
    grade: fieldConfidence.grade.value,
    gradingCompany: fieldConfidence.gradingCompany.value,
    parallel: fieldConfidence.parallel.value,
    player: fieldConfidence.player.value,
    set: fieldConfidence.set.value,
    sourceConfidence: aggregateConfidence(fieldConfidence),
    sport: fieldConfidence.sport.value,
    team: fieldConfidence.team.value,
    year: fieldConfidence.year.value,
    buyingOptions,
    condition: item.condition ?? "",
    itemEndDate: item.itemEndDate ?? "",
    listingType,
    marketplaceId,
    aspects,
  });
}

function extractFromAspects(aspects: Record<string, string>, title: string): AspectFields {
  const aspectTeam = firstAspect(aspects, ["Team"]);
  const aspectSport = firstAspect(aspects, ["Sport"]);
  const grader = firstAspect(aspects, ["Professional Grader", "Grader"]);
  const grade = firstAspect(aspects, ["Grade"]);
  const normalizedGrade = normalizeGrade(grader, grade);
  const team = normalizeTeam(aspectTeam, title);

  return {
    brand: firstAspect(aspects, ["Manufacturer", "Brand"]),
    cardNumber: firstAspect(aspects, ["Card Number", "Card #", "Card No."]),
    certNumber: firstAspect(aspects, [
      "Certification Number",
      "Certification",
      "PSA Cert",
      "BGS Cert",
    ]),
    grade: normalizedGrade.grade,
    gradingCompany: normalizedGrade.gradingCompany,
    parallel: firstAspect(aspects, [
      "Parallel/Variety",
      "Parallel",
      "Variety",
      "Insert",
    ]),
    player: cleanPlayerName(firstAspect(aspects, ["Player/Athlete", "Player", "Athlete"])),
    set: firstAspect(aspects, ["Set", "Product"]),
    sport: aspectSport || sportFromText(`${title} ${team} ${aspectTeam}`),
    team,
    year: firstAspect(aspects, ["Season", "Year Manufactured", "Year"]),
  };
}

function normalizeGrade(grader: string, grade: string) {
  if (
    /not professionally graded|ungraded|raw/i.test(grader) ||
    /not professionally graded|ungraded|raw/i.test(grade)
  ) {
    return { grade: "", gradingCompany: "" };
  }

  return {
    grade: grader && grade ? `${grader.toUpperCase()} ${grade}` : "",
    gradingCompany: grader,
  };
}

function scoreFields(aspects: AspectFields, parsed: ParsedTitle) {
  const field = (
    aspectValue: string,
    parsedValue: string,
    aspectConfidence: number,
    parsedConfidence: number,
  ): FieldResult => {
    const cleanAspect = aspectValue.trim();
    const cleanParsed = parsedValue.trim();

    if (cleanAspect) {
      return {
        confidence: aspectConfidence,
        source: "ebay_aspects",
        value: cleanAspect,
      };
    }

    if (cleanParsed) {
      return {
        confidence: parsedConfidence,
        source: "title_parser",
        value: cleanParsed,
      };
    }

    return { confidence: 0, source: "title_parser", value: "" };
  };

  return {
    brand: field(aspects.brand, parsed.brand, 0.97, 0.85),
    cardNumber: field(aspects.cardNumber, parsed.cardNumber, 0.97, 0.8),
    certNumber: field(aspects.certNumber, parsed.certNumber, 0.99, 0.75),
    grade: field(aspects.grade, parsed.grade || "Raw", 0.98, parsed.grade ? 0.9 : 0.55),
    gradingCompany: field(aspects.gradingCompany, parsed.gradingCompany, 0.98, 0.9),
    parallel: field(aspects.parallel, parsed.parallel, 0.9, 0.72),
    player: field(bestPlayer(aspects.player, parsed.player, parsed.cardNumber), parsed.player, 0.95, 0.68),
    set: field(aspects.set, parsed.set, 0.9, 0.62),
    sport: field(aspects.sport, parsed.sport, 0.98, 0.7),
    team: field(aspects.team, parsed.team, 0.9, 0.72),
    year: field(aspects.year, parsed.year, 0.98, 0.95),
  };
}

function aggregateConfidence(fields: Record<string, FieldResult>) {
  const weights: Record<string, number> = {
    brand: 12,
    cardNumber: 6,
    grade: 8,
    player: 24,
    set: 12,
    sport: 12,
    team: 8,
    year: 18,
  };
  const totalWeight = Object.values(weights).reduce((total, weight) => total + weight, 0);
  const score = Object.entries(weights).reduce((total, [key, weight]) => {
    const confidence = fields[key]?.confidence ?? 0;
    return total + confidence * weight;
  }, 0);

  return Math.round((score / totalWeight) * 100);
}

function firstAspect(aspects: Record<string, string>, keys: string[]) {
  const normalizedEntries = Object.entries(aspects).map(([key, value]) => [
    key.toLowerCase().replace(/[^a-z0-9]/g, ""),
    value,
  ]);

  for (const key of keys) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    const match = normalizedEntries.find(([entryKey]) => entryKey === normalizedKey);
    if (match?.[1]) return match[1];
  }

  return "";
}

function extractEbayItemId(value: string) {
  const decoded = decodeURIComponent(value);
  const itmMatch = decoded.match(/\/itm\/(?:[^/?#]+\/)?(\d{9,})/i);
  if (itmMatch) return itmMatch[1];

  const queryMatch = decoded.match(/[?&](?:item|itemId|itemid)=?(\d{9,})/i);
  if (queryMatch) return queryMatch[1];

  const anyLongNumber = decoded.match(/\b\d{9,}\b/);
  return anyLongNumber?.[0] ?? "";
}

function marketplaceFromUrl(value: string) {
  const lower = value.toLowerCase();

  if (lower.includes("ebay.ca")) return "EBAY_CA";
  if (lower.includes("ebay.co.uk")) return "EBAY_GB";
  if (lower.includes("ebay.com.au")) return "EBAY_AU";
  if (lower.includes("ebay.de")) return "EBAY_DE";

  return "EBAY_US";
}

function setFromTitle(title: string) {
  const sets = [
    "Bowman Chrome",
    "Topps Chrome",
    "Stadium Club",
    "Upper Deck",
    "National Treasures",
    "SP Authentic",
    "Young Guns",
    "Series 1",
    "Series 2",
    "Chrome",
    "Prizm",
    "Optic",
    "Select",
    "Mosaic",
    "Heritage",
    "Finest",
  ];
  return sets
    .filter((set) => new RegExp(`\\b${escapeRegExp(set).replaceAll("\\ ", "\\s+")}\\b`, "i").test(title))
    .slice(0, 3)
    .join(" ");
}

function normalizeTeam(aspectTeam: string, title: string) {
  const titleTeam = teamFromText(title);
  if (titleTeam) return titleTeam;

  if (!/[;,/|]/.test(aspectTeam)) return teamFromText(aspectTeam) || aspectTeam;

  const candidates = aspectTeam
    .split(/[;,/|]/)
    .map((team) => team.trim())
    .filter(Boolean);
  const exactTeam = candidates.map((team) => teamFromText(team)).find(Boolean);

  return exactTeam || candidates[0] || "";
}

function parseTitle(title: string) {
  const upper = title.toUpperCase();
  const year = title.match(/\b(19[8-9]\d|20[0-2]\d)(?:-\d{2})?\b/)?.[0] ?? "";
  const brandMap: Record<string, string[]> = {
    "Bowman Chrome": ["BOWMAN CHROME", "B.CHROME"],
    "National Treasures": ["NATIONAL TREASURES", " NT "],
    "SP Authentic": ["SP AUTHENTIC", " SPA "],
    "Stadium Club": ["STADIUM CLUB"],
    "Upper Deck": ["UPPER DECK", "U.D.", " UD "],
    Immaculate: ["IMMACULATE"],
    Contenders: ["CONTENDERS"],
    Bowman: ["BOWMAN"],
    Chrome: ["CHROME"],
    Donruss: ["DONRUSS"],
    Fleer: ["FLEER"],
    Leaf: ["LEAF"],
    Mosaic: ["MOSAIC"],
    Optic: ["OPTIC"],
    Panini: ["PANINI"],
    Prizm: ["PRIZM"],
    Score: ["SCORE"],
    Select: ["SELECT"],
    SPx: ["SPX"],
    Topps: ["TOPPS"],
  };
  const brand =
    Object.entries(brandMap).find(([, keywords]) =>
      keywords.some((keyword) => upper.includes(keyword)),
    )?.[0] ?? "";
  const parallelKeywords = [
    "SUPERFRACTOR",
    "GOLD REFRACTOR",
    "RED REFRACTOR",
    "BLUE REFRACTOR",
    "ORANGE REFRACTOR",
    "PURPLE REFRACTOR",
    "REFRACTOR",
    "SILVER",
    "GOLD",
    "BLUE",
    "RED",
    "ORANGE",
    "GREEN",
    "PURPLE",
    "PINK",
    "AQUA",
    "HOLO",
    "RAINBOW",
    "CRACKED ICE",
    "SHIMMER",
    "WAVE",
    "SCOPE",
    "DISCO",
    "CUBIC",
    "CHOICE",
    "HYPER",
  ];
  const printRun = title.match(/\/(\d{2,4})\b/)?.[0] ?? "";
  const parallel = [
    parallelKeywords.find((keyword) => keywordInTitle(upper, keyword)) ?? "",
    printRun,
  ]
    .filter(Boolean)
    .join(" ");
  const gradeMatch = title.match(/\b(PSA|BGS|SGC|CSG|HGA|CGC)\s*(\d+(?:\.\d)?)\b/i);
  const grade = gradeMatch ? `${gradeMatch[1].toUpperCase()} ${gradeMatch[2]}` : "";
  const gradingCompany = gradeMatch?.[1]?.toUpperCase() ?? "";
  const certNumber = title.match(/\b(\d{8,10})\b/)?.[1] ?? "";
  const cardNumber =
    title.match(/#\s*([A-Z]{0,5}-?\d+[A-Z]?)\b/i)?.[1] ??
    title.match(/\b([A-Z]{1,5}-\d{1,4}[A-Z]?)\b/i)?.[1] ??
    "";
  const set = setFromTitle(title);
  const noise = [
    year,
    brand,
    set,
    parallel,
    grade,
    certNumber,
    cardNumber ? `#?\\s*${escapeRegExp(cardNumber)}` : "",
    "/\\d{2,4}",
    "PSA|BGS|SGC|CSG|HGA|CGC",
    "SAPPHIRE|RC|SP|SSP|AUTO|AUTOGRAPH|PATCH|REFRACTOR|CHROME|PRIZM|GOLD|SILVER|BLUE|RED|YELLOW|ROOKIE|GEM|MINT|NM|HOT|INVEST|RARE|FREE SHIP|CALLED UP",
  ]
    .filter(Boolean)
    .join("|");
  const player = cleanPlayerName(titleCase(
    title
      .replace(new RegExp(noise, "gi"), " ")
      .replace(/[^\w\s.'-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .slice(0, 2)
      .join(" "),
  ));

  return {
    brand,
    cardNumber,
    certNumber,
    grade,
    gradingCompany,
    parallel,
    player,
    set,
    sport: sportFromText(title),
    team: teamFromText(title),
    year,
  };
}

function bestPlayer(aspectPlayer: string, parsedPlayer: string, cardNumber: string) {
  const cleanAspect = cleanPlayerName(aspectPlayer);
  const cleanParsed = cleanPlayerName(parsedPlayer);
  const suspiciousAspect = Boolean(
    cleanAspect &&
      (cardNumber && normalizeLoose(cleanAspect).includes(normalizeLoose(cardNumber)) ||
        /\b(sapphire|chrome|bowman|topps|panini|select|prizm|bcp)\b/i.test(cleanAspect)),
  );

  if (suspiciousAspect && cleanParsed) return "";
  return cleanAspect;
}

function cleanPlayerName(value: string) {
  return value
    .replace(/\b[A-Z]{1,5}-\d{1,4}[A-Z]?\b/gi, " ")
    .replace(/\b(sapphire|chrome|bowman|topps|panini|select|prizm|rookie|card)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLoose(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function keywordInTitle(upperTitle: string, keyword: string) {
  const pattern = keyword
    .split(/\s+/)
    .map((part) => escapeRegExp(part))
    .join("\\s+");

  return new RegExp(`\\b${pattern}\\b`).test(upperTitle);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
