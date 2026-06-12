import { NextResponse } from "next/server";
import { EbayConfigError, getEbayAppToken } from "@/lib/ebay";
import { checkRateLimit, requestIdentifier } from "@/lib/rate-limit";

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

  return NextResponse.json({
    title,
    imageUrl: item.image?.imageUrl ?? item.additionalImages?.[0]?.imageUrl ?? "",
    itemWebUrl: item.itemWebUrl ?? listingUrl,
    price: priceValue ? `$${priceValue}` : "",
    priceLabel,
    brand: firstAspect(aspects, ["Brand"]) || brandFromTitle(title),
    cardNumber: firstAspect(aspects, ["Card Number", "Card #", "Card No."]) || cardNumberFromTitle(title),
    parallel: firstAspect(aspects, ["Parallel/Variety", "Parallel", "Variety"]) || parallelFromTitle(title),
    player: firstAspect(aspects, ["Player/Athlete", "Player", "Athlete"]) || playerFromTitle(title),
    set: firstAspect(aspects, ["Set"]) || setFromTitle(title),
    sport: firstAspect(aspects, ["Sport"]) || sportFromTitle(title),
    team: firstAspect(aspects, ["Team"]) || teamFromTitle(title),
    year: firstAspect(aspects, ["Season", "Year Manufactured", "Year"]) || yearFromTitle(title),
    buyingOptions,
    condition: item.condition ?? "",
    itemEndDate: item.itemEndDate ?? "",
    listingType,
    marketplaceId,
    aspects,
  });
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

function brandFromTitle(title: string) {
  const brands = [
    "Topps",
    "Bowman",
    "Panini",
    "Upper Deck",
    "Donruss",
    "Prizm",
    "Select",
    "Mosaic",
    "Optic",
    "Fleer",
    "Score",
    "Leaf",
    "Stadium Club",
    "Heritage",
    "Chrome",
  ];

  return brands.find((brand) => title.toLowerCase().includes(brand.toLowerCase())) ?? "";
}

function cardNumberFromTitle(title: string) {
  return title.match(/(?:card\s*)?#\s?([A-Z0-9-]{1,12})\b/i)?.[1] ?? "";
}

function parallelFromTitle(title: string) {
  const parallels = [
    "Refractor",
    "X-Fractor",
    "Superfractor",
    "Silver",
    "Holo",
    "Gold",
    "Blue",
    "Red",
    "Green",
    "Orange",
    "Purple",
    "Black",
    "Mosaic",
    "Prizm",
    "Sepia",
    "Negative",
    "Atomic",
  ];

  return parallels.filter((parallel) => title.toLowerCase().includes(parallel.toLowerCase())).join(" ");
}

function playerFromTitle(title: string) {
  const cleanTitle = title
    .replace(/\b(19|20)\d{2}\b/g, "")
    .replace(/\b(topps|panini|upper deck|bowman|fleer|donruss|select|mosaic|optic|score|leaf|heritage|chrome)\b/gi, "")
    .replace(/\b(rookie|rc|auto|autograph|patch|relic|jersey|refractor|holo|silver|gold|card|graded|psa|bgs|sgc|csg|gem|mint)\b/gi, "")
    .replace(/\b\d+(\.\d+)?\b/g, "")
    .replace(/[#:/|()[\]-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return titleCase(cleanTitle.split(" ").slice(0, 3).join(" "));
}

function setFromTitle(title: string) {
  const sets = ["Chrome", "Prizm", "Optic", "Select", "Mosaic", "Heritage", "Stadium Club", "Finest"];
  return sets.filter((set) => title.toLowerCase().includes(set.toLowerCase())).join(" ");
}

function sportFromTitle(title: string) {
  const lower = title.toLowerCase();

  if (/(nba|basketball|lakers|celtics|raptors|warriors|bulls|knicks)/.test(lower)) return "Basketball";
  if (/(mlb|baseball|blue jays|yankees|dodgers|reds|braves|mets)/.test(lower)) return "Baseball";
  if (/(nfl|football|steelers|cowboys|packers|chiefs|49ers)/.test(lower)) return "Football";
  if (/(nhl|hockey|maple leafs|canadiens|bruins|oilers)/.test(lower)) return "Hockey";
  if (/(soccer|football club|fc |fifa|uefa|premier league)/.test(lower)) return "Soccer";

  return "";
}

function teamFromTitle(title: string) {
  const teams = [
    "Raptors",
    "Reds",
    "Steelers",
    "Lakers",
    "Yankees",
    "Maple Leafs",
    "Blue Jays",
    "Dodgers",
    "Celtics",
    "Warriors",
  ];

  return teams.find((team) => title.toLowerCase().includes(team.toLowerCase())) ?? "";
}

function yearFromTitle(title: string) {
  return title.match(/\b(19|20)\d{2}(?:-\d{2})?\b/)?.[0] ?? "";
}

function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
