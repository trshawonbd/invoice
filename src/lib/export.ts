import type { Receipt } from "./types";

const cell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** One row per item, so personal and business lines of a split receipt stay apart. */
export function downloadCsv(receipts: Receipt[], fileName: string) {
  const header = ["Date", "Shop", "Item", "Category", "Personal/Business", "Amount", "Payment", "Note"];
  const rows = receipts
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((r) =>
      r.items.map((i) => [r.date, r.merchant, i.name, i.category, i.wallet, i.amount.toFixed(2), r.paymentMethod ?? "", r.note ?? ""]),
    );
  const csv = [header, ...rows].map((row) => row.map(cell).join(",")).join("\n");
  downloadBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), fileName);
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const receiptFileName = (r: Receipt, ext: string) =>
  `${r.date}-${r.merchant.replace(/[^\w-]+/g, "-").toLowerCase()}.${ext}`.replace(/-+/g, "-");

