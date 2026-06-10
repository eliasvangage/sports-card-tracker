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
          "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
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

  return NextResponse.json({
    title: item.title ?? "",
    imageUrl: item.image?.imageUrl ?? item.additionalImages?.[0]?.imageUrl ?? "",
    itemWebUrl: item.itemWebUrl ?? listingUrl,
    price: item.price?.value ? `$${item.price.value}` : "",
    brand: aspects.Brand ?? "",
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
