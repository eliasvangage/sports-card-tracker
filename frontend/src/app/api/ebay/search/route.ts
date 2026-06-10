import { NextResponse } from "next/server";
import { EbayConfigError, getEbayAppToken } from "@/lib/ebay";
import { checkRateLimit, requestIdentifier } from "@/lib/rate-limit";

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
  const rateLimit = checkRateLimit({
    identifier: `ebay-search:${requestIdentifier(request)}`,
    limit: 20,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many eBay market scans. Try again in a minute." },
      { status: 429 },
    );
  }

  if (query.length < 3) {
    return NextResponse.json(
      { error: "Search needs at least 3 characters." },
      { status: 400 },
    );
  }

  let response: Response;

  try {
    const token = await getEbayAppToken();
    response = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(query)}&category_ids=212&limit=12`,
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
            ? "eBay market search is ready, but the server eBay credentials are not configured yet."
            : "Unable to connect to eBay right now.",
      },
      { status: error instanceof EbayConfigError ? 501 : 502 },
    );
  }

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
