import { NextResponse } from "next/server";
import { identifyFromTitle } from "@/lib/cardIdentifier";
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
  const identified = identifyFromTitle(title, aspects);
  const fieldConfidence = {
    brand: identified.brand,
    cardNumber: identified.cardNumber,
    certNumber: identified.certNumber,
    grade: identified.grade,
    gradingCompany: identified.gradingCompany,
    parallel: identified.parallel,
    player: identified.player,
    set: identified.set,
    sport: identified.sport,
    team: identified.team,
    year: identified.year,
  } satisfies Record<string, FieldResult>;

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
    sourceConfidence: identified.overallConfidence,
    sport: fieldConfidence.sport.value,
    tags: identified.tags,
    team: fieldConfidence.team.value,
    printRun: identified.printRun,
    year: fieldConfidence.year.value,
    buyingOptions,
    condition: item.condition ?? "",
    itemEndDate: item.itemEndDate ?? "",
    listingType,
    marketplaceId,
    aspects,
  });
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
