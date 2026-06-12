import { NextResponse } from "next/server";
import { checkRateLimit, requestIdentifier } from "@/lib/rate-limit";

type VisionCardRequest = {
  imageUrl?: string;
  sourceUrl?: string;
  title?: string;
};

type CardVisionSuggestion = {
  brand?: string;
  cardNumber?: string;
  certNumber?: string;
  grade?: string;
  parallel?: string;
  player?: string;
  set?: string;
  sport?: string;
  team?: string;
  year?: string;
};

export async function POST(request: Request) {
  const rateLimit = checkRateLimit({
    identifier: `vision-card:${requestIdentifier(request)}`,
    limit: 8,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many vision scans. Try again in a minute." },
      { status: 429 },
    );
  }

  let body: VisionCardRequest;

  try {
    body = (await request.json()) as VisionCardRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const imageUrl = body.imageUrl?.trim();

  if (!imageUrl) {
    return NextResponse.json(
      { error: "Vision scan needs a card image URL." },
      { status: 400 },
    );
  }

  if (imageUrl.startsWith("data:")) {
    return NextResponse.json(
      {
        configured: false,
        message:
          "OCR for local image uploads needs hosted image storage first. Imported eBay images can be scanned once a vision provider is connected.",
        provider: "none",
        suggestions: {},
      },
      { status: 200 },
    );
  }

  const provider = process.env.CARDROSTER_VISION_PROVIDER ?? "disabled";

  if (provider === "disabled") {
    return NextResponse.json({
      configured: false,
      message:
        "Vision scan route is ready. Add a provider such as Google Cloud Vision on the server to enable OCR suggestions.",
      provider,
      suggestions: heuristicSuggestions(body.title ?? ""),
    });
  }

  return NextResponse.json(
    {
      configured: false,
      error: `Vision provider "${provider}" is not implemented yet.`,
      provider,
      suggestions: heuristicSuggestions(body.title ?? ""),
    },
    { status: 501 },
  );
}

function heuristicSuggestions(title: string): CardVisionSuggestion {
  return {
    cardNumber: title.match(/(?:card\s*)?#\s?([A-Z0-9-]{1,12})\b/i)?.[1],
    grade: title.match(/\b(PSA|BGS|SGC|CGC)\s?(10|9\.5|9|8\.5|8)\b/i)?.[0],
    year: title.match(/\b(19|20)\d{2}(?:-\d{2})?\b/)?.[0],
  };
}
