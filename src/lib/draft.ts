import { today } from "./dates";
import type { Item, Receipt } from "./types";

/** A receipt being checked or edited before it is saved. */
export type Draft = Omit<Receipt, "createdAt"> & { createdAt?: number };

export const emptyDraft = (): Draft => ({
  merchant: "",
  date: today(),
  items: [{ name: "", amount: 0, category: "Groceries", wallet: "personal" }],
});

export type View =
  | { name: "home" }
  | { name: "scan" }
  | { name: "review"; draft: Draft; suggested?: Item[] }
  | { name: "receipts" }
  | { name: "detail"; id: number }
  | { name: "insights" }
  | { name: "settings" };
