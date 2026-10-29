export interface Prepared {
  kind: "image" | "pdf";
  /** What gets stored with the receipt. Images are downscaled to save space. */
  blob: Blob;
  base64: string;
  mediaType: "image/jpeg" | "application/pdf";
}

const MAX_SIDE = 1800;

export async function prepareFile(file: File): Promise<Prepared> {
  if (file.type === "application/pdf") {
    return { kind: "pdf", blob: file, base64: await toBase64(file), mediaType: "application/pdf" };
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read the photo"))), "image/jpeg", 0.85),
  );
  return { kind: "image", blob, base64: await toBase64(blob), mediaType: "image/jpeg" };
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
