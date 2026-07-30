import { identifyFromTitle } from "@/lib/cardIdentifier";

export type EbayReportKind = "activeListings" | "orders";

export type EbayCsvImportCard = {
  id: string;
  player: string;
  sport: string;
  team: string;
  year: string;
  brand: string;
  set: string;
  cardNumber?: string;
  parallel?: string;
  status: "Vaulted" | "Wishlist" | "For Trade";
  grade: string;
  gradingCompany?: string;
  certNumber?: string;
  color: string;
  collection: string;
  estimatedValue?: string;
  salePrice?: string;
  saleStatus?: "Holding" | "Listed" | "Sold";
  sourceUrl?: string;
  sourceName?: string;
  frameStyle?: "Card" | "Gradient" | "Sunset" | "Stand";
  borderStyle?: "Soft" | "Chrome" | "Glow";
  tags?: Array<"Rookie" | "Auto" | "Patch" | "Numbered" | "Favorite">;
  notes?: string;
  ebayItemNumber?: string;
  ebayOrderNumber?: string;
  ebaySku?: string;
  ebayQuantity?: number;
  ebaySoldQuantity?: number;
  ebayWatchers?: number;
  ebayBids?: number;
  ebayCurrency?: string;
  ebayListingFormat?: string;
  ebayCondition?: string;
  ebayListedAt?: string;
  ebayListingEndsAt?: string;
  ebayDaysActive?: number;
  ebayPromoted?: boolean;
  ebayBuyerUsername?: string;
  ebaySaleDate?: string;
  ebayPaidOnDate?: string;
  ebayShipByDate?: string;
  ebayShippedOnDate?: string;
  ebayShippingService?: string;
  ebayTrackingNumber?: string;
  ebayShippingCharged?: string;
  ebayOrderTotal?: string;
  ebayCollectedTax?: string;
};

export type EbayCsvImportResult = {
  kind: EbayReportKind;
  cards: EbayCsvImportCard[];
  rowCount: number;
  skippedRows: number;
};

type CsvRecord = Record<string, string>;

const cardTags = ["Rookie", "Auto", "Patch", "Numbered", "Favorite"] as const;

export function parseEbayReportCsv(text: string, collection: string, accent: string): EbayCsvImportResult {
  const records = csvRecords(text);
  const kind = detectReportKind(records);

  if (!kind) {
    throw new Error("That CSV does not look like an eBay active listings or orders report.");
  }

  const cards = records
    .map((record) =>
      kind === "activeListings"
        ? activeListingToCard(record, collection, accent)
        : orderToCard(record, collection, accent),
    )
    .filter((card): card is EbayCsvImportCard => card !== null);

  return {
    kind,
    cards,
    rowCount: records.length,
    skippedRows: records.length - cards.length,
  };
}

export function mergeEbayImportCards(
  existingCards: EbayCsvImportCard[],
  importedCards: EbayCsvImportCard[],
) {
  const nextCards = [...existingCards];
  let created = 0;
  let updated = 0;

  for (const importedCard of importedCards) {
    const existingIndex = nextCards.findIndex((card) => sameEbayRecord(card, importedCard));

    if (existingIndex === -1) {
      nextCards.unshift(importedCard);
      created += 1;
      continue;
    }

    nextCards[existingIndex] = mergeCard(nextCards[existingIndex], importedCard);
    updated += 1;
  }

  return { cards: nextCards, created, updated };
}

function activeListingToCard(record: CsvRecord, collection: string, accent: string): EbayCsvImportCard | null {
  const title = value(record, "Title");
  const itemNumber = value(record, "Item number");
  if (!title || !itemNumber) return null;

  const identified = identifyFromTitle(title, reportAspects(record));
  const startDate = value(record, "Start date");
  const endDate = value(record, "End date");
  const currentPrice = value(record, "Current price") || value(record, "Start price");
  const availableQuantity = numberValue(value(record, "Available quantity"));
  const soldQuantity = numberValue(value(record, "Sold quantity"));
  const soldOut = availableQuantity === 0 && soldQuantity > 0;

  return {
    ...cardIdentity(title, identified, collection, accent),
    status: "For Trade",
    saleStatus: soldOut ? "Sold" : "Listed",
    estimatedValue: moneyString(currentPrice, value(record, "Currency")),
    salePrice: soldOut ? moneyString(currentPrice, value(record, "Currency")) : "",
    sourceUrl: ebayListingUrl(itemNumber, value(record, "Listing site")),
    sourceName: "eBay CSV",
    ebayItemNumber: itemNumber,
    ebaySku: value(record, "Custom label (SKU)"),
    ebayQuantity: availableQuantity,
    ebaySoldQuantity: soldQuantity,
    ebayWatchers: numberValue(value(record, "Watchers")),
    ebayBids: numberValue(value(record, "Bids")),
    ebayCurrency: value(record, "Currency") || "CAD",
    ebayListingFormat: value(record, "Format"),
    ebayCondition: value(record, "Condition") || value(record, "CD:Card Condition - (ID: 40001)"),
    ebayListedAt: startDate,
    ebayListingEndsAt: endDate,
    ebayDaysActive: daysBetween(startDate, soldOut ? endDate : undefined),
    notes: noteParts([
      value(record, "Variation details") ? `Variation: ${value(record, "Variation details")}` : "",
      value(record, "Condition") ? `Condition: ${value(record, "Condition")}` : "",
    ]),
  };
}

function orderToCard(record: CsvRecord, collection: string, accent: string): EbayCsvImportCard | null {
  const title = value(record, "Item Title");
  const itemNumber = value(record, "Item Number");
  const orderNumber = value(record, "Order Number");
  if (!title || !itemNumber || !orderNumber) return null;

  const identified = identifyFromTitle(title);
  const saleDate = value(record, "Sale Date");
  const shipByDate = value(record, "Ship By Date");
  const shippedOnDate = value(record, "Shipped On Date");

  return {
    ...cardIdentity(title, identified, collection, accent),
    status: "For Trade",
    saleStatus: "Sold",
    salePrice: moneyString(value(record, "Sold For")),
    estimatedValue: moneyString(value(record, "Sold For")),
    sourceUrl: ebayListingUrl(itemNumber),
    sourceName: "eBay orders CSV",
    ebayItemNumber: itemNumber,
    ebayOrderNumber: orderNumber,
    ebaySku: value(record, "Custom Label"),
    ebayQuantity: numberValue(value(record, "Quantity")),
    ebaySoldQuantity: numberValue(value(record, "Quantity")),
    ebayCurrency: currencyFromMoney(value(record, "Sold For")) || "CAD",
    ebayPromoted: yesNo(value(record, "Sold Via Promoted Listings")),
    ebayBuyerUsername: value(record, "Buyer Username"),
    ebaySaleDate: saleDate,
    ebayPaidOnDate: value(record, "Paid On Date"),
    ebayShipByDate: shipByDate,
    ebayShippedOnDate: shippedOnDate,
    ebayShippingService: value(record, "Shipping Service"),
    ebayTrackingNumber: value(record, "Tracking Number"),
    ebayShippingCharged: moneyString(value(record, "Shipping And Handling")),
    ebayOrderTotal: moneyString(value(record, "Total Price")),
    ebayCollectedTax: moneyString(value(record, "eBay Collected Tax")),
    ebayDaysActive: undefined,
    notes: noteParts([
      shipByDate && !shippedOnDate ? `Ship by ${shipByDate}` : "",
      shippedOnDate ? `Shipped ${shippedOnDate}` : "",
      value(record, "Feedback Received") ? `Feedback: ${value(record, "Feedback Received")}` : "",
    ]),
  };
}

function cardIdentity(
  title: string,
  identified: ReturnType<typeof identifyFromTitle>,
  collection: string,
  accent: string,
) {
  return {
    id: crypto.randomUUID(),
    player: identified.player.value || title,
    sport: normalizeSport(identified.sport.value),
    team: identified.team.value || "Unknown Team",
    year: identified.year.value || "Unknown Year",
    brand: identified.brand.value || "Unknown Brand",
    set: identified.set.value || "Base Set",
    cardNumber: identified.cardNumber.value,
    parallel: identified.parallel.value,
    grade: identified.grade.value || "Raw",
    gradingCompany: identified.gradingCompany.value,
    certNumber: identified.certNumber.value,
    color: accent,
    collection,
    frameStyle: "Card" as const,
    borderStyle: "Soft" as const,
    tags: identified.tags.filter((tag): tag is (typeof cardTags)[number] =>
      cardTags.includes(tag as (typeof cardTags)[number]),
    ),
    imageX: 50,
    imageY: 50,
    imageZoom: 100,
    imageRotation: 0,
  };
}

function csvRecords(text: string) {
  const rows = parseCsvRows(text).filter((row) => row.some((cell) => cell.trim()));
  const headerIndex = rows.findIndex((row) => {
    const headers = row.map((cell) => cell.trim().toLowerCase());
    return (
      headers.includes("item number") &&
      (headers.includes("title") || headers.includes("item title"))
    );
  });

  if (headerIndex === -1) return [];

  const headers = rows[headerIndex].map((header) => header.trim());
  return rows.slice(headerIndex + 1).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() ?? ""])),
  );
}

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === "\"" && quoted && next === "\"") {
      cell += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

function detectReportKind(records: CsvRecord[]): EbayReportKind | null {
  const first = records[0];
  if (!first) return null;
  if ("Title" in first && "Current price" in first) return "activeListings";
  if ("Item Title" in first && "Order Number" in first) return "orders";
  return null;
}

function mergeCard(existingCard: EbayCsvImportCard, importedCard: EbayCsvImportCard): EbayCsvImportCard {
  return {
    ...existingCard,
    ...Object.fromEntries(
      Object.entries(importedCard).filter(([, itemValue]) => itemValue !== "" && itemValue !== undefined),
    ),
    id: existingCard.id,
    notes: noteParts([existingCard.notes, importedCard.notes]),
    tags: Array.from(new Set([...(existingCard.tags ?? []), ...(importedCard.tags ?? [])])),
  };
}

function sameEbayRecord(existingCard: EbayCsvImportCard, importedCard: EbayCsvImportCard) {
  if (importedCard.ebayOrderNumber && existingCard.ebayOrderNumber === importedCard.ebayOrderNumber) return true;
  if (importedCard.ebayItemNumber && existingCard.ebayItemNumber === importedCard.ebayItemNumber) return true;
  if (importedCard.sourceUrl && existingCard.sourceUrl === importedCard.sourceUrl) return true;
  return false;
}

function reportAspects(record: CsvRecord) {
  return {
    "Professional Grader": value(record, "CD:Professional Grader - (ID: 27501)"),
    Grade: value(record, "CD:Grade - (ID: 27502)"),
    "Certification Number": value(record, "CDA:Certification Number - (ID: 27503)"),
  };
}

function value(record: CsvRecord, key: string) {
  return record[key]?.trim() ?? "";
}

function numberValue(value: string) {
  const clean = value.replace(/[^0-9.-]/g, "");
  const number = Number(clean);
  return Number.isFinite(number) ? number : 0;
}

function moneyString(value: string, fallbackCurrency = "") {
  const amount = numberValue(value);
  if (!amount) return "";
  const currency = currencyFromMoney(value) || fallbackCurrency || "CAD";
  return `${currency === "CAD" ? "C $" : "$"}${amount.toFixed(2)}`;
}

function currencyFromMoney(value: string) {
  if (/C\s*\$/i.test(value)) return "CAD";
  if (/\bCAD\b/i.test(value)) return "CAD";
  if (/\bUSD\b/i.test(value)) return "USD";
  return "";
}

function ebayListingUrl(itemNumber: string, listingSite = "") {
  const host = listingSite === "CA" ? "www.ebay.ca" : "www.ebay.com";
  return itemNumber ? `https://${host}/itm/${itemNumber}` : "";
}

function daysBetween(start: string, end = "") {
  const startDate = parseEbayDate(start);
  const endDate = parseEbayDate(end) ?? new Date();
  if (!startDate) return undefined;
  return Math.max(0, Math.ceil((endDate.getTime() - startDate.getTime()) / 86_400_000));
}

function parseEbayDate(value: string) {
  const match = value.match(/^([A-Za-z]{3})-(\d{1,2})-(\d{2})(?:\s+(\d{1,2}):(\d{2}):(\d{2}))?/);
  if (!match) return null;
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(match[1]);
  if (month === -1) return null;
  const year = 2000 + Number(match[3]);
  return new Date(Date.UTC(year, month, Number(match[2]), Number(match[4] ?? 0), Number(match[5] ?? 0), Number(match[6] ?? 0)));
}

function yesNo(value: string) {
  return value.trim().toLowerCase() === "yes";
}

function noteParts(parts: Array<string | undefined>) {
  return Array.from(new Set(parts.filter(Boolean))).join(" | ");
}

function normalizeSport(value: string) {
  if (value === "Pokemon" || value === "Magic") return "TCG";
  return value || "Baseball";
}
