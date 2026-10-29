import Dexie, { type EntityTable } from "dexie";
import type { Item, Receipt, Rule } from "./types";

export const db = new Dexie("receipt-money") as Dexie & {
  receipts: EntityTable<Receipt, "id">;
  rules: EntityTable<Rule, "key">;
};

db.version(1).stores({
  receipts: "++id, date, merchant, createdAt",
  rules: "key",
});

export const ruleKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

/** Remember category / wallet choices that differ from what the AI suggested. */
export async function learnFrom(original: Item[], saved: Item[]) {
  const byName = new Map(original.map((i) => [ruleKey(i.name), i]));
  const rules: Rule[] = [];
  for (const item of saved) {
    const key = ruleKey(item.name);
    const before = byName.get(key);
    if (before && (before.category !== item.category || before.wallet !== item.wallet)) {
      rules.push({ key, category: item.category, wallet: item.wallet });
    }
  }
  if (rules.length) await db.rules.bulkPut(rules);
}

export async function applyRules(items: Item[]): Promise<Item[]> {
  const rules = await db.rules.bulkGet(items.map((i) => ruleKey(i.name)));
  return items.map((item, n) => {
    const rule = rules[n];
    return rule ? { ...item, category: rule.category, wallet: rule.wallet, flag: undefined } : item;
  });
}
