import { NextResponse } from "next/server";

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

  if (!legacyItemId) {
    return NextResponse.json(
      { error: "Paste a valid eBay listing URL with an item number." },
      { status: 400 },
    );
  }

  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      {
        error:
          "eBay import is ready, but EBAY_CLIENT_ID and EBAY_CLIENT_SECRET are not set yet.",
      },
      { status: 501 },
    );
  }

  const token = await getEbayToken(clientId, clientSecret);
  const itemResponse = await fetch(
    `https://api.ebay.com/buy/browse/v1/item/get_item_by_legacy_id?legacy_item_id=${legacyItemId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      },
    },
  );

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

async function getEbayToken(clientId: string, clientSecret: string) {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }),
  });

  if (!response.ok) {
    throw new Error("Unable to authenticate with eBay.");
  }

  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) {
    throw new Error("eBay did not return an access token.");
  }

  return body.access_token;
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
