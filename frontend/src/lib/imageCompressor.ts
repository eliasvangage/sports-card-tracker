export async function compressForStorage(
  dataUrl: string,
  maxWidth = 800,
  quality = 0.75,
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, maxWidth / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/webp", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function getStorageUsageMB(): number {
  if (typeof localStorage === "undefined") return 0;

  let total = 0;
  for (const key in localStorage) {
    if (key.startsWith("cardroster.")) {
      total += localStorage.getItem(key)?.length ?? 0;
    }
  }

  return (total * 2) / (1024 * 1024);
}
