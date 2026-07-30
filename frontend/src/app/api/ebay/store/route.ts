import { NextResponse } from "next/server";
import { identifyFromTitle } from "@/lib/cardIdentifier";
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
  buyingOptions?: string[];
  condition?: string;
  itemCreationDate?: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const seller = cleanSeller(searchParams.get("seller") ?? "");
  const marketplaceId = marketplaceFromParam(searchParams.get("marketplace") ?? "");
  const limit = clampLimit(Number(searchParams.get("limit")) || 25);
  const query = cleanQuery(searchParams.get("q") ?? "");
  const rateLimit = checkRateLimit({
    identifier: `ebay-store:${requestIdentifier(request)}`,
    limit: 8,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many eBay store imports. Try again in a minute." },
      { status: 429 },
    );
  }

  if (!seller) {
    return NextResponse.json(
      { error: "Enter a valid eBay seller username." },
      { status: 400 },
    );
  }

  let response: Response;

  try {
    const token = await getEbayAppToken();
    const params = new URLSearchParams({
      category_ids: "212",
      filter: `sellers:{${seller}}`,
      limit: String(limit),
      sort: "newlyListed",
    });

    if (query) params.set("q", query);

    response = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-EBAY-C-MARKETPLACE-ID": marketplaceId,
        },
        next: { revalidate: 60 },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof EbayConfigError
            ? "eBay store import is ready, but the server eBay credentials are not configured yet."
            : "Unable to connect to eBay right now.",
      },
      { status: error instanceof EbayConfigError ? 501 : 502 },
    );
  }

  if (!response.ok) {
    return NextResponse.json(
      { error: "eBay did not return listings for that seller." },
      { status: response.status },
    );
  }

  const body = (await response.json()) as {
    itemSummaries?: EbaySearchItem[];
    total?: number;
  };
  const listings = (body.itemSummaries ?? []).map((item) => {
    const title = item.title ?? "";
    const identified = identifyFromTitle(title);
    const price = item.price?.value ?? "";

    return {
      title,
      imageUrl: item.image?.imageUrl ?? "",
      itemWebUrl: item.itemWebUrl ?? "",
      price: price ? `$${price}` : "",
      currency: item.price?.currency ?? "USD",
      buyingOptions: item.buyingOptions ?? [],
      condition: item.condition ?? "",
      listedAt: item.itemCreationDate ?? "",
      player: identified.player.value,
      sport: identified.sport.value,
      team: identified.team.value,
      year: identified.year.value,
      brand: identified.brand.value,
      set: identified.set.value,
      cardNumber: identified.cardNumber.value,
      parallel: identified.parallel.value,
      grade: identified.grade.value,
      gradingCompany: identified.gradingCompany.value,
      certNumber: identified.certNumber.value,
      tags: identified.tags,
      sourceConfidence: identified.overallConfidence,
    };
  });

  return NextResponse.json({
    seller,
    marketplaceId,
    total: body.total ?? listings.length,
    listings,
  });
}

function cleanSeller(value: string) {
  return value.trim().replace(/^@/, "").match(/^[A-Za-z0-9_.-]{2,64}$/)?.[0] ?? "";
}

function cleanQuery(value: string) {
  return value
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, " ")
    .replace(/[^\w\s./#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function clampLimit(value: number) {
  return Math.min(50, Math.max(5, value));
}

function marketplaceFromParam(value: string) {
  if (value === "EBAY_CA" || value === "EBAY_GB" || value === "EBAY_AU" || value === "EBAY_DE") {
    return value;
  }

  return "EBAY_US";
}
