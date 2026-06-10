import { NextResponse } from "next/server";

type EbaySearchItem = {
  title?: string;
  itemWebUrl?: string;
  image?: {
    imageUrl?: string;
  };
  price?: {
    value?: string;
    currency?: string;
  };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (query.length < 3) {
    return NextResponse.json(
      { error: "Search needs at least 3 characters." },
      { status: 400 },
    );
  }

  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      {
        error:
          "eBay market search is ready, but EBAY_CLIENT_ID and EBAY_CLIENT_SECRET are not set yet.",
      },
      { status: 501 },
    );
  }

  const token = await getEbayToken(clientId, clientSecret);
  const response = await fetch(
    `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(query)}&category_ids=212&limit=12`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      },
    },
  );

  if (!response.ok) {
    return NextResponse.json(
      { error: "eBay market search did not return results." },
      { status: response.status },
    );
  }

  const body = (await response.json()) as { itemSummaries?: EbaySearchItem[] };
  const listings = (body.itemSummaries ?? []).map((item) => ({
    title: item.title ?? "",
    itemWebUrl: item.itemWebUrl ?? "",
    imageUrl: item.image?.imageUrl ?? "",
    price: item.price?.value ? Number(item.price.value) : null,
    currency: item.price?.currency ?? "USD",
  }));
  const prices = listings
    .map((listing) => listing.price)
    .filter((price): price is number => typeof price === "number" && Number.isFinite(price));
  const suggestedValue =
    prices.length > 0
      ? Math.round(prices.reduce((total, price) => total + price, 0) / prices.length)
      : null;

  return NextResponse.json({
    query,
    suggestedValue,
    listings,
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
