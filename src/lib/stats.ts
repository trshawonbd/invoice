import type { WalletFilter } from "../components/Segmented";
import type { Item, Receipt } from "./types";

export const sum = (items: Item[]) => Math.round(items.reduce((a, i) => a + i.amount, 0) * 100) / 100;

export function itemsOf(receipts: Receipt[], wallet: WalletFilter = "all"): Item[] {
  const all = receipts.flatMap((r) => r.items);
  return wallet === "all" ? all : all.filter((i) => i.wallet === wallet);
}

export interface CategoryTotal {
  category: string;
  amount: number;
  mostlyBusiness: boolean;
}

export function byCategory(items: Item[]): CategoryTotal[] {
  const map = new Map<string, { amount: number; business: number }>();
  for (const i of items) {
    const c = map.get(i.category) ?? { amount: 0, business: 0 };
    c.amount += i.amount;
    if (i.wallet === "business") c.business += i.amount;
    map.set(i.category, c);
  }
  return [...map]
    .map(([category, c]) => ({ category, amount: c.amount, mostlyBusiness: c.business > c.amount / 2 }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

export type ReceiptKind = "Personal" | "Business" | "Split";

export function kindOf(r: Receipt): ReceiptKind {
  const wallets = new Set(r.items.map((i) => i.wallet));
  if (wallets.size > 1) return "Split";
  return wallets.has("business") ? "Business" : "Personal";
}

export function categoryLabel(r: Receipt): string {
  const cats = [...new Set(r.items.map((i) => i.category))];
  if (!cats.length) return "No items";
  return cats.length > 1 ? `${cats[0]} +${cats.length - 1}` : cats[0];
}
