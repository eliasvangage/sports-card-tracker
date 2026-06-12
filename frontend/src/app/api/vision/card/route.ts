import { NextResponse } from "next/server";
import { checkRateLimit, requestIdentifier } from "@/lib/rate-limit";

type VisionCardRequest = {
  imageBase64?: string;
  imageUrl?: string;
  sourceUrl?: string;
  title?: string;
};

type VisionField = {
  confidence: number;
  value: string;
};

type VisionFields = {
  brand: VisionField;
  cardNumber: VisionField;
  certNumber: VisionField;
  grade: VisionField;
  gradingCompany: VisionField;
  parallel: VisionField;
  player: VisionField;
  set: VisionField;
  sport: VisionField;
  team: VisionField;
  year: VisionField;
};

type GoogleVisionResponse = {
  responses?: Array<{
    error?: { message?: string };
    fullTextAnnotation?: {
      text?: string;
    };
    labelAnnotations?: Array<{
      description?: string;
      score?: number;
    }>;
    textAnnotations?: Array<{
      description?: string;
    }>;
  }>;
};

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

export async function POST(request: Request) {
  const rateLimit = checkRateLimit({
    identifier: `vision-card:${requestIdentifier(request)}`,
    limit: 5,
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

  const imageBase64 = cleanBase64(body.imageBase64 ?? body.imageUrl ?? "");
  const imageUrl = body.imageUrl?.startsWith("http") ? body.imageUrl.trim() : "";
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  const provider = process.env.CARDROSTER_VISION_PROVIDER ?? "disabled";

  if (!imageBase64 && !imageUrl) {
    return NextResponse.json(
      { error: "Vision scan needs a base64 image or hosted image URL." },
      { status: 400 },
    );
  }

  if (imageBase64 && imageBase64.length > 7_000_000) {
    return NextResponse.json(
      { error: "Image is too large for OCR. Try a smaller photo." },
      { status: 413 },
    );
  }

  if (provider !== "google" || !apiKey) {
    const fields = extractCardFields(body.title ?? "", []);

    return NextResponse.json({
      configured: false,
      fields,
      message:
        "Vision scan route is ready. Add GOOGLE_CLOUD_VISION_API_KEY and set CARDROSTER_VISION_PROVIDER=google in Vercel to enable OCR.",
      provider,
      suggestions: toSuggestions(fields),
    });
  }

  let visionResponse: Response;

  try {
    visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`,
      {
        body: JSON.stringify({
          requests: [
            {
              features: [
                { maxResults: 1, type: "TEXT_DETECTION" },
                { maxResults: 8, type: "LABEL_DETECTION" },
              ],
              image: imageBase64
                ? { content: imageBase64 }
                : { source: { imageUri: imageUrl } },
            },
          ],
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to run card vision scan right now." },
      { status: 502 },
    );
  }

  if (!visionResponse.ok) {
    return NextResponse.json(
      { error: "Card vision scan did not return results." },
      { status: 502 },
    );
  }

  const visionBody = (await visionResponse.json()) as GoogleVisionResponse;
  const result = visionBody.responses?.[0];

  if (result?.error) {
    return NextResponse.json(
      { error: "Card vision scan could not read that image." },
      { status: 422 },
    );
  }

  const ocrText =
    result?.fullTextAnnotation?.text ??
    result?.textAnnotations?.[0]?.description ??
    "";
  const labels =
    result?.labelAnnotations
      ?.map((label) => ({
        confidence: roundConfidence(label.score ?? 0),
        value: label.description ?? "",
      }))
      .filter((label) => label.value) ?? [];
  const fields = extractCardFields(
    [body.title, ocrText].filter(Boolean).join("\n"),
    labels.map((label) => label.value),
  );

  return NextResponse.json({
    configured: true,
    fields,
    labels,
    provider: "google",
    suggestions: toSuggestions(fields),
  });
}

function emptyField(): VisionField {
  return { confidence: 0, value: "" };
}

function extractCardFields(text: string, labels: string[]): VisionFields {
  const normalizedText = text.replace(/\s+/g, " ").trim();
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const brand = findKnownValue(normalizedText, brands, 0.9);
  const parallel = findKnownValue(normalizedText, parallels, 0.75);
  const grade = findGrade(normalizedText);
  const year = findYear(normalizedText);
  const cardNumber = findCardNumber(normalizedText);
  const certNumber = findCertNumber(normalizedText, grade.value);
  const sport = findSport(normalizedText, labels);
  const player = findPlayerCandidate(lines, normalizedText);
  const set = findSetCandidate(lines, brand.value, parallel.value);

  return {
    brand,
    cardNumber,
    certNumber,
    grade,
    gradingCompany: grade.value
      ? { confidence: grade.confidence, value: grade.value.split(" ")[0] }
      : emptyField(),
    parallel,
    player,
    set,
    sport,
    team: emptyField(),
    year,
  };
}

function findKnownValue(text: string, values: string[], confidence: number) {
  const lower = text.toLowerCase();
  const value = values.find((item) => lower.includes(item.toLowerCase()));

  return value ? { confidence, value } : emptyField();
}

function findYear(text: string) {
  const match = text.match(/\b(19|20)\d{2}(?:-\d{2})?\b/);
  return match ? { confidence: 0.85, value: match[0] } : emptyField();
}

function findGrade(text: string) {
  const match = text.match(/\b(PSA|BGS|SGC|CGC|CSG)\s?(10|9\.5|9|8\.5|8)\b/i);

  return match
    ? { confidence: 0.9, value: `${match[1].toUpperCase()} ${match[2]}` }
    : emptyField();
}

function findCardNumber(text: string) {
  const match = text.match(/(?:card\s*)?#\s?([A-Z0-9-]{1,12})\b/i);
  return match ? { confidence: 0.75, value: match[1] } : emptyField();
}

function findCertNumber(text: string, grade: string) {
  if (!grade) return emptyField();

  const match = text.match(/\b\d{7,10}\b/);
  return match ? { confidence: 0.65, value: match[0] } : emptyField();
}

function findSport(text: string, labels: string[]) {
  const lower = `${text} ${labels.join(" ")}`.toLowerCase();

  if (/(basketball|nba|lakers|celtics|raptors|warriors|bulls|knicks)/.test(lower)) {
    return { confidence: 0.8, value: "Basketball" };
  }

  if (/(baseball|mlb|blue jays|yankees|dodgers|reds|braves|mets)/.test(lower)) {
    return { confidence: 0.8, value: "Baseball" };
  }

  if (/(football|nfl|steelers|cowboys|packers|chiefs|49ers)/.test(lower)) {
    return { confidence: 0.78, value: "Football" };
  }

  if (/(hockey|nhl|maple leafs|canadiens|bruins|oilers)/.test(lower)) {
    return { confidence: 0.78, value: "Hockey" };
  }

  if (/(soccer|fifa|uefa|premier league|football club)/.test(lower)) {
    return { confidence: 0.72, value: "Soccer" };
  }

  if (/(pokemon|pokémon|tcg|charizard|pikachu)/.test(lower)) {
    return { confidence: 0.78, value: "Pokemon" };
  }

  return emptyField();
}

function findPlayerCandidate(lines: string[], text: string) {
  const blocked = [
    ...brands,
    ...parallels,
    "rookie",
    "autograph",
    "signature",
    "select",
    "sports",
    "trading",
    "card",
    "cards",
    "cert",
    "authentic",
    "gem mint",
  ];
  const candidates = lines
    .map((line) =>
      line
        .replace(/\b(19|20)\d{2}(?:-\d{2})?\b/g, "")
        .replace(/[#/|()[\]:]+/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((line) => {
      const lower = line.toLowerCase();
      const words = line.split(" ").filter(Boolean);

      return (
        words.length >= 2 &&
        words.length <= 4 &&
        /^[A-Za-z .'-]+$/.test(line) &&
        !blocked.some((term) => lower.includes(term.toLowerCase()))
      );
    });

  if (candidates[0]) {
    return { confidence: 0.55, value: titleCase(candidates[0]) };
  }

  const titleCandidate = text.match(/\b[A-Z][a-z]+ [A-Z][a-z]+(?: [A-Z][a-z]+)?\b/);
  return titleCandidate
    ? { confidence: 0.35, value: titleCandidate[0] }
    : emptyField();
}

function findSetCandidate(lines: string[], brand: string, parallel: string) {
  const setLine = lines.find((line) => {
    const lower = line.toLowerCase();
    return (
      lower.length <= 40 &&
      ["chrome", "prizm", "optic", "select", "mosaic", "heritage", "finest"].some(
        (term) => lower.includes(term),
      )
    );
  });

  if (!setLine) return emptyField();

  const value = setLine
    .replace(new RegExp(brand, "ig"), "")
    .replace(new RegExp(parallel, "ig"), "")
    .replace(/\s+/g, " ")
    .trim();

  return value ? { confidence: 0.45, value: titleCase(value) } : emptyField();
}

function toSuggestions(fields: VisionFields) {
  return Object.fromEntries(
    Object.entries(fields)
      .filter(([, field]) => field.value && field.confidence >= 0.5)
      .map(([key, field]) => [key, field.value]),
  );
}

function cleanBase64(value: string) {
  if (!value.startsWith("data:")) return "";
  return value.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "").trim();
}

function roundConfidence(value: number) {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
