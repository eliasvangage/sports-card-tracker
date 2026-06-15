import { sportFromText, teamFromText } from "@/lib/card-taxonomy";

export type IdentifiedField = {
  confidence: number;
  source: "ebay_aspects" | "title_parser";
  value: string;
};

export type IdentifiedCard = {
  player: IdentifiedField;
  year: IdentifiedField;
  brand: IdentifiedField;
  set: IdentifiedField;
  parallel: IdentifiedField;
  cardNumber: IdentifiedField;
  grade: IdentifiedField;
  gradingCompany: IdentifiedField;
  certNumber: IdentifiedField;
  sport: IdentifiedField;
  team: IdentifiedField;
  tags: string[];
  printRun: string;
  overallConfidence: number;
};

type FieldName =
  | "brand"
  | "cardNumber"
  | "certNumber"
  | "grade"
  | "gradingCompany"
  | "parallel"
  | "player"
  | "set"
  | "sport"
  | "team"
  | "year";

const blankField: IdentifiedField = {
  confidence: 0,
  source: "title_parser",
  value: "",
};

export function identifyFromTitle(
  title: string,
  aspects: Record<string, string> = {},
): IdentifiedCard {
  const normalizedAspects = normalizeAspects(aspects);
  const aspectFields = fieldsFromAspects(normalizedAspects);
  const parsedFields = fieldsFromTitle(title);
  const fields = mergeFields(aspectFields, parsedFields);
  const fieldValues = Object.values(fields);
  const overallConfidence =
    fieldValues.reduce((total, field) => total + field.confidence, 0) /
    fieldValues.length;

  return {
    ...fields,
    tags: tagsFromTitle(title),
    printRun: printRunFromTitle(title),
    overallConfidence: Math.round(overallConfidence * 100),
  };
}

function fieldsFromAspects(aspects: Record<string, string>): Record<FieldName, IdentifiedField> {
  const grader = firstAspect(aspects, ["Professional Grader", "Grader"]);
  const gradeValue = firstAspect(aspects, ["Grade"]);
  const normalizedGrade = normalizeAspectGrade(grader, gradeValue);

  return {
    brand: aspectField(firstAspect(aspects, ["Manufacturer", "Brand"])),
    cardNumber: aspectField(firstAspect(aspects, ["Card Number", "Card #", "Card No."])),
    certNumber: aspectField(
      firstAspect(aspects, [
        "Certification Number",
        "Certification",
        "PSA Cert",
        "BGS Cert",
      ]),
    ),
    grade: aspectField(normalizedGrade.grade),
    gradingCompany: aspectField(normalizedGrade.gradingCompany),
    parallel: aspectField(
      firstAspect(aspects, [
        "Parallel/Variety",
        "Parallel",
        "Variety",
        "Insert",
      ]),
    ),
    player: aspectField(
      cleanPlayerName(firstAspect(aspects, ["Player/Athlete", "Player", "Athlete"])),
    ),
    set: aspectField(cleanSetName(firstAspect(aspects, ["Set", "Product"]))),
    sport: aspectField(firstAspect(aspects, ["Sport"])),
    team: aspectField(firstAspect(aspects, ["Team"])),
    year: aspectField(firstAspect(aspects, ["Season", "Year", "Year Manufactured"])),
  };
}

function fieldsFromTitle(title: string): Record<FieldName, IdentifiedField> {
  const cleanTitle = stripEmoji(title);
  const upperTitle = ` ${cleanTitle.toUpperCase()} `;
  const grade = gradeFromTitle(cleanTitle);
  const brand = brandFromTitle(upperTitle);
  const year = yearFromTitle(cleanTitle);
  const parallel = parallelFromTitle(upperTitle);
  const cardNumber = cardNumberFromTitle(cleanTitle);
  const certNumber = certNumberFromTitle(cleanTitle);
  const set = setFromTitle(cleanTitle, brand.value);
  const team = teamFromText(cleanTitle);
  const sport = detectSport(cleanTitle, team);
  const player = playerFromTitle(cleanTitle, {
    brand: brand.value,
    cardNumber: cardNumber.value,
    certNumber: certNumber.value,
    grade: grade.grade.value,
    parallel: parallel.value,
    set: set.value,
    year: year.value,
  });

  return {
    brand,
    cardNumber,
    certNumber,
    grade: grade.grade,
    gradingCompany: grade.gradingCompany,
    parallel,
    player,
    set,
    sport: titleField(sport, sport ? 0.72 : 0),
    team: titleField(team, team ? 0.78 : 0),
    year,
  };
}

function mergeFields(
  aspectFields: Record<FieldName, IdentifiedField>,
  parsedFields: Record<FieldName, IdentifiedField>,
) {
  return Object.fromEntries(
    (Object.keys(aspectFields) as FieldName[]).map((key) => [
      key,
      aspectFields[key].value ? aspectFields[key] : parsedFields[key],
    ]),
  ) as Record<FieldName, IdentifiedField>;
}

function aspectField(value: string): IdentifiedField {
  const clean = cleanAspectValue(value);

  return clean
    ? { confidence: 0.95, source: "ebay_aspects", value: clean }
    : { ...blankField };
}

function titleField(value: string, confidence: number): IdentifiedField {
  const clean = value.trim();

  return clean
    ? { confidence, source: "title_parser", value: clean }
    : { ...blankField };
}

function normalizeAspects(aspects: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(aspects).map(([key, value]) => [
      normalizeAspectKey(key),
      value,
    ]),
  );
}

function firstAspect(aspects: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = aspects[normalizeAspectKey(key)];
    if (value?.trim()) return value.trim();
  }

  return "";
}

function normalizeAspectKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cleanAspectValue(value: string) {
  const clean = value.trim();
  return /^(none|n\/a|na|null|undefined|not specified|unknown)$/i.test(clean)
    ? ""
    : clean;
}

function cleanSetName(value: string) {
  return cleanAspectValue(value)
    .replace(/\b(19[8-9]\d|20[0-3]\d)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAspectGrade(grader: string, grade: string) {
  if (
    /not professionally graded|ungraded|raw/i.test(grader) ||
    /not professionally graded|ungraded|raw/i.test(grade)
  ) {
    return { grade: "", gradingCompany: "" };
  }

  const company = grader.trim().toUpperCase();
  const cleanGrade = grade.trim();

  return {
    grade: company && cleanGrade ? `${company} ${cleanGrade}` : "",
    gradingCompany: company,
  };
}

function brandFromTitle(upperTitle: string) {
  const match = brandMap.find((brand) =>
    brand.keywords.some((keyword) => upperTitle.includes(keyword)),
  );

  return titleField(match?.name ?? "", match ? 0.85 : 0);
}

function parallelFromTitle(upperTitle: string) {
  const match = parallelMap.find((parallel) =>
    parallel.keywords.some((keyword) => upperTitle.includes(keyword)),
  );
  const printRun = printRunFromTitle(upperTitle);
  const value = [match?.name ?? "", printRun].filter(Boolean).join(" ");

  return titleField(value, value ? 0.76 : 0);
}

function gradeFromTitle(title: string) {
  const match = title.match(/\b(PSA|BGS|SGC|CSG|HGA|CGC)\s*(\d+(?:\.\d)?)\b/i);
  const company = match?.[1]?.toUpperCase() ?? "";
  const gradeValue = match ? `${company} ${match[2]}` : "";

  return {
    grade: titleField(gradeValue, gradeValue ? 0.9 : 0),
    gradingCompany: titleField(company, company ? 0.9 : 0),
  };
}

function yearFromTitle(title: string) {
  const value = title.match(/\b(19[8-9]\d|20[0-3]\d)(?:-\d{2})?\b/)?.[0] ?? "";
  return titleField(value, value ? 0.95 : 0);
}

function cardNumberFromTitle(title: string) {
  const value =
    title.match(/#\s*([A-Z]{0,6}-?\d+[A-Z]?)\b/i)?.[1] ??
    title.match(/\b(?:card\s*(?:no\.?|number|#)\s*)([A-Z]{0,6}-?\d+[A-Z]?)\b/i)?.[1] ??
    title.match(/\b([A-Z]{1,6}-\d{1,5}[A-Z]?)\b/i)?.[1] ??
    "";

  return titleField(value, value ? 0.82 : 0);
}

function certNumberFromTitle(title: string) {
  const value = title.match(/\b(\d{7,12})\b/)?.[1] ?? "";
  return titleField(value, value ? 0.72 : 0);
}

function setFromTitle(title: string, brand: string) {
  const upperTitle = ` ${title.toUpperCase()} `;
  const explicitSet = setPatterns.find((set) =>
    set.keywords.some((keyword) => upperTitle.includes(keyword)),
  )?.name;
  const value =
    explicitSet ??
    (brand && /\bchrome\s+black\b/i.test(title) ? `${brand} Black` : brand);

  return titleField(value, value ? 0.68 : 0);
}

function playerFromTitle(
  title: string,
  known: {
    brand: string;
    cardNumber: string;
    certNumber: string;
    grade: string;
    parallel: string;
    set: string;
    year: string;
  },
) {
  const noise = [
    known.year,
    known.brand,
    known.set,
    known.parallel,
    known.grade,
    known.certNumber,
    known.cardNumber ? `#?\\s*${escapeRegExp(known.cardNumber)}` : "",
    "\\/\\d{1,5}",
    "\\bPSA\\b|\\bBGS\\b|\\bSGC\\b|\\bCSG\\b|\\bHGA\\b|\\bCGC\\b",
    tagNoisePattern,
    hypePattern,
    parallelNoisePattern,
  ]
    .filter(Boolean)
    .join("|");
  const cleaned = stripEmoji(title)
    .replace(new RegExp(noise, "gi"), " ")
    .replace(/[^\w\s.'-]/g, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned
    .split(" ")
    .filter((word) => word.length > 1 && !playerStopWords.has(word.toLowerCase()));
  const player = titleCase(words.slice(0, 3).join(" "));
  const confidence = words.length >= 2 ? 0.85 : words.length === 1 ? 0.65 : 0;

  if (!player || /^[A-Z]$/i.test(player) || /^\d+$/.test(player)) {
    return { ...blankField };
  }

  return titleField(player, confidence);
}

function detectSport(title: string, team: string) {
  const explicit = sportFromText(`${title} ${team}`);
  const lower = title.toLowerCase();

  if (explicit) return explicit;
  if (/\b(nba|basketball|hoops|court)\b/.test(lower)) return "Basketball";
  if (/\b(nfl|football|gridiron)\b/.test(lower)) return "Football";
  if (/\b(nhl|hockey|puck)\b/.test(lower)) return "Hockey";
  if (/\b(mls|soccer|uefa|fifa|futbol)\b/.test(lower)) return "Soccer";
  if (/\b(pokemon|magic|mtg|yugioh|one piece|tcg)\b/.test(lower)) return "TCG";
  if (/\b(mlb|baseball|topps|bowman)\b/.test(lower)) return "Baseball";

  return "";
}

function tagsFromTitle(title: string) {
  const tags: string[] = [];
  const upperTitle = ` ${title.toUpperCase()} `;

  if (/\b(RC|ROOKIE|ROOKIE CARD)\b/.test(upperTitle)) tags.push("Rookie");
  if (/\b(AUTO|AUTOGRAPH|SIGNED|AU)\b/.test(upperTitle)) tags.push("Auto");
  if (/\b(PATCH|RPA)\b/.test(upperTitle)) tags.push("Patch");
  if (/\d+/.test(title)) tags.push("Numbered");

  return Array.from(new Set(tags));
}

function printRunFromTitle(title: string) {
  return title.match(/\/\s*(\d{1,5})\b/)?.[0].replace(/\s+/g, "") ?? "";
}

function cleanPlayerName(value: string) {
  return stripEmoji(value)
    .replace(/[;,/|]+/g, " ")
    .replace(/\b(sapphire|chrome|bowman|topps|panini|select|prizm|rookie|card)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripEmoji(value: string) {
  return value.replace(/[\p{Extended_Pictographic}\uFE0F]/gu, " ");
}

function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const brandMap = [
  { name: "Bowman Chrome", keywords: [" BOWMAN CHROME "] },
  { name: "Bowman Draft", keywords: [" BOWMAN DRAFT "] },
  { name: "Bowman", keywords: [" BOWMAN "] },
  { name: "Topps Chrome", keywords: [" TOPPS CHROME "] },
  { name: "Topps Heritage", keywords: [" TOPPS HERITAGE "] },
  { name: "Topps", keywords: [" TOPPS "] },
  { name: "National Treasures", keywords: [" NATIONAL TREASURES ", " NT "] },
  { name: "Immaculate", keywords: [" IMMACULATE "] },
  { name: "Panini Prizm", keywords: [" PANINI PRIZM "] },
  { name: "Prizm", keywords: [" PRIZM "] },
  { name: "Panini", keywords: [" PANINI "] },
  { name: "Select", keywords: [" SELECT "] },
  { name: "Mosaic", keywords: [" MOSAIC "] },
  { name: "Optic", keywords: [" OPTIC "] },
  { name: "Donruss", keywords: [" DONRUSS "] },
  { name: "Upper Deck", keywords: [" UPPER DECK ", " UD "] },
  { name: "Stadium Club", keywords: [" STADIUM CLUB "] },
  { name: "SP Authentic", keywords: [" SP AUTHENTIC ", " SPA "] },
  { name: "Contenders", keywords: [" CONTENDERS "] },
  { name: "Score", keywords: [" SCORE "] },
  { name: "Fleer", keywords: [" FLEER "] },
];

const parallelMap = [
  { name: "Superfractor /1", keywords: [" SUPERFRACTOR "] },
  { name: "Gold Refractor", keywords: [" GOLD REFRACTOR "] },
  { name: "Gold", keywords: [" GOLD "] },
  { name: "Silver", keywords: [" SILVER "] },
  { name: "Blue Refractor", keywords: [" BLUE REFRACTOR "] },
  { name: "Red Refractor", keywords: [" RED REFRACTOR "] },
  { name: "Refractor", keywords: [" REFRACTOR "] },
  { name: "Prizm Silver", keywords: [" PRIZM SILVER ", " SILVER PRIZM "] },
  { name: "Holo", keywords: [" HOLO ", " HOLOGRAPHIC "] },
  { name: "Rainbow", keywords: [" RAINBOW "] },
  { name: "Cracked Ice", keywords: [" CRACKED ICE "] },
  { name: "Shimmer", keywords: [" SHIMMER "] },
  { name: "Aqua", keywords: [" AQUA "] },
  { name: "Orange", keywords: [" ORANGE "] },
  { name: "Purple", keywords: [" PURPLE "] },
  { name: "Pink", keywords: [" PINK "] },
  { name: "Green", keywords: [" GREEN "] },
  { name: "Disco", keywords: [" DISCO "] },
  { name: "Hyper", keywords: [" HYPER "] },
];

const setPatterns = [
  { name: "Topps Chrome Black", keywords: [" TOPPS CHROME BLACK ", " CHROME BLACK "] },
  { name: "Topps Chrome", keywords: [" TOPPS CHROME "] },
  { name: "Topps Heritage", keywords: [" TOPPS HERITAGE "] },
  { name: "Bowman Chrome", keywords: [" BOWMAN CHROME "] },
  { name: "Bowman Draft", keywords: [" BOWMAN DRAFT "] },
  { name: "National Treasures", keywords: [" NATIONAL TREASURES "] },
  { name: "SP Authentic", keywords: [" SP AUTHENTIC "] },
  { name: "Stadium Club", keywords: [" STADIUM CLUB "] },
  { name: "Upper Deck", keywords: [" UPPER DECK "] },
  { name: "Series 1", keywords: [" SERIES 1 "] },
  { name: "Series 2", keywords: [" SERIES 2 "] },
  { name: "Prizm", keywords: [" PRIZM "] },
  { name: "Optic", keywords: [" OPTIC "] },
  { name: "Select", keywords: [" SELECT "] },
  { name: "Mosaic", keywords: [" MOSAIC "] },
  { name: "Finest", keywords: [" FINEST "] },
];

const tagNoisePattern =
  "\\bRC\\b|\\bROOKIE\\b|\\bROOKIE CARD\\b|\\bAUTO\\b|\\bAUTOGRAPH\\b|\\bPATCH\\b|\\bSP\\b|\\bSSP\\b|\\bRPA\\b";
const hypePattern =
  "\\bRARE\\b|\\bHOT\\b|\\bFIRE\\b|\\bINVEST\\b|\\bINVESTMENT\\b|\\bGEM\\b|\\bMINT\\b|\\bFREE SHIP\\b|\\bWOW\\b";
const parallelNoisePattern =
  "\\bSUPERFRACTOR\\b|\\bREFRACTOR\\b|\\bSILVER\\b|\\bGOLD\\b|\\bBLUE\\b|\\bRED\\b|\\bORANGE\\b|\\bPURPLE\\b|\\bPINK\\b|\\bGREEN\\b|\\bAQUA\\b|\\bHOLO\\b|\\bRAINBOW\\b|\\bCRACKED ICE\\b|\\bSHIMMER\\b|\\bDISCO\\b|\\bHYPER\\b";

const playerStopWords = new Set([
  "base",
  "black",
  "blue",
  "card",
  "chrome",
  "jays",
  "rookie",
  "toronto",
]);
