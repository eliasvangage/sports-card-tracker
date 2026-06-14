"use client";

import { useRef, useState } from "react";

export type ScanField = {
  confidence: number;
  value: string;
};

export type CardScanResult = {
  fields: Record<string, ScanField>;
  imageUrl: string;
};

export function CardScanner({
  onScanComplete,
}: {
  onScanComplete: (result: CardScanResult) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, ScanField>>({});
  const [imageUrl, setImageUrl] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const visibleFields = Object.entries(fields).filter(
    ([, field]) => field.value || field.confidence > 0,
  );

  async function scanFile(file: File | undefined) {
    if (!file || isScanning) return;

    setError("");
    setFields({});
    setIsScanning(true);

    try {
      const compressedImage = await compressImage(file);
      setImageUrl(compressedImage);

      const response = await fetch("/api/vision/card", {
        body: JSON.stringify({ imageBase64: compressedImage, title: file.name }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to scan this card.");
      }

      const nextFields = result.fields ?? {};
      setFields(nextFields);
      onScanComplete({ fields: nextFields, imageUrl: compressedImage });
    } catch (scanError) {
      setError(
        scanError instanceof Error
          ? scanError.message
          : "Unable to scan this card.",
      );
    } finally {
      setIsScanning(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section
      className={`overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(21,27,36,0.98),rgba(8,12,18,0.98))] p-4 shadow-2xl ${
        isScanning ? "animate-pulse" : ""
      }`}
    >
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <label className="group relative flex min-h-[250px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-white/20 bg-black/30 p-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:-translate-y-0.5 hover:border-white/35 hover:bg-white/[0.06]">
          <div className="absolute inset-x-6 top-5 h-1 rounded-full bg-[linear-gradient(90deg,#ff5533,#20e3b2,#38bdf8)] opacity-80" />
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt="Scanned card preview"
              className="absolute inset-0 h-full w-full object-contain p-6"
            />
          ) : null}
          {isScanning ? (
            <div className="absolute inset-0 z-20 grid place-items-center bg-[#05070b]/70 backdrop-blur-sm">
              <div className="rounded-2xl border border-white/10 bg-[#151b24] px-5 py-4 shadow-2xl">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#ff5533]" />
                <p className="mt-3 text-xs font-black uppercase tracking-[0.18em] text-slate-300">
                  Reading card
                </p>
              </div>
            </div>
          ) : null}
          <div className={`relative z-10 ${imageUrl ? "opacity-0" : "opacity-100"}`}>
            <div className="mx-auto grid size-16 place-items-center rounded-2xl border border-white/10 bg-white/5 text-3xl font-black text-white shadow-[0_0_34px_rgba(255,85,51,0.28)]">
              +
            </div>
            <p className="mt-4 text-lg font-black text-white">
              Add a card image
            </p>
            <p className="mx-auto mt-2 max-w-xs text-xs font-bold leading-5 text-slate-400">
              Camera or upload. A review draft appears below.
            </p>
          </div>
          <input
            ref={inputRef}
            accept="image/*"
            capture="environment"
            className="hidden"
            type="file"
            onChange={(event) => scanFile(event.target.files?.[0])}
          />
        </label>

        <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-black/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                  Image identification
                </p>
                <h2 className="mt-2 text-2xl font-black leading-tight text-white">
                  Scan, then verify.
                </h2>
              </div>
            </div>
            <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-slate-300">
              OCR suggestions fill the draft, but the review queue stays in control.
            </p>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {visibleFields.length ? (
                visibleFields.map(([key, field]) => (
                  <ConfidenceField key={key} label={key} field={field} />
                ))
              ) : (
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs font-bold text-slate-400 sm:col-span-2">
                  Scan results will appear here.
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isScanning}
              className="h-10 rounded-lg bg-[#ff5533] px-4 text-sm font-black text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isScanning ? "Scanning..." : "Choose image"}
            </button>
            <button
              type="button"
              onClick={() => {
                setFields({});
                setImageUrl("");
                setError("");
              }}
              className="h-10 rounded-lg border border-white/10 bg-black/20 px-4 text-sm font-black text-slate-300 hover:bg-white/10"
            >
              Reset
            </button>
          </div>

          {error ? (
            <p className="mt-3 rounded-lg border border-red-300/20 bg-red-400/10 p-3 text-xs font-bold leading-5 text-red-100">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ConfidenceField({ field, label }: { field: ScanField; label: string }) {
  const confidenceClass =
    field.confidence > 0.8
      ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
      : field.confidence >= 0.5
        ? "border-amber-300/20 bg-amber-300/10 text-amber-100"
        : "border-red-300/20 bg-red-400/10 text-red-100";

  return (
    <div className="rounded-lg border border-white/10 bg-black/25 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
          {label}
        </p>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${confidenceClass}`}>
          {Math.round(field.confidence * 100)}%
        </span>
      </div>
      <p className="mt-1 truncate text-sm font-black text-white">
        {field.value || "Needs review"}
      </p>
    </div>
  );
}

async function compressImage(file: File) {
  const source = await readFile(file);
  const image = await loadImage(source);
  const maxLongSide = 1200;
  const scale = Math.min(1, maxLongSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) return source;

  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
