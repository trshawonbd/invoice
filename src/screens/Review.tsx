import { useEffect, useState } from "react";
import { Icon } from "../components/Icon";
import { BUSINESS_CATEGORIES, CATEGORIES } from "../lib/categories";
import { db, learnFrom } from "../lib/db";
import type { Draft, View } from "../lib/draft";
import { money, useSettings } from "../lib/settings";
import { sum } from "../lib/stats";
import type { Item } from "../lib/types";

interface Props {
  view: Extract<View, { name: "review" }>;
  go: (v: View) => void;
  notify: (message: string) => void;
}

export function Review({ view, go, notify }: Props) {
  const { currency } = useSettings();
  const [draft, setDraft] = useState<Draft>(view.draft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string>();
  const isEdit = draft.id !== undefined;

  useEffect(() => {
    if (!draft.image || draft.image.type === "application/pdf") return;
    const url = URL.createObjectURL(draft.image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [draft.image]);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const setItem = (n: number, patch: Partial<Item>) =>
    setDraft((d) => ({ ...d, items: d.items.map((it, i) => (i === n ? { ...it, ...patch, flag: undefined } : it)) }));
  const removeItem = (n: number) => setDraft((d) => ({ ...d, items: d.items.filter((_, i) => i !== n) }));
  const addItem = () =>
    setDraft((d) => ({ ...d, items: [...d.items, { name: "", amount: 0, category: "Other", wallet: "personal" }] }));

  const total = sum(draft.items);
  const personal = sum(draft.items.filter((i) => i.wallet === "personal"));
  const business = sum(draft.items.filter((i) => i.wallet === "business"));
  const mismatch = draft.printedTotal !== undefined && Math.abs(draft.printedTotal - total) > 0.01;
  const unsure = draft.items.filter((i) => i.flag).length;

  async function save() {
    const items = draft.items.filter((i) => i.name.trim() || i.amount);
    if (!draft.merchant.trim()) return setError("Add the shop name.");
    if (!items.length) return setError("Add at least one item.");
    setSaving(true);
    const receipt = {
      ...draft,
      merchant: draft.merchant.trim(),
      items: items.map((i) => ({ ...i, name: i.name.trim() || "Item", flag: undefined })),
      createdAt: draft.createdAt ?? Date.now(),
    };
    const id = await db.receipts.put(receipt);
    if (view.suggested) await learnFrom(view.suggested, receipt.items);
    const cats = new Set(receipt.items.map((i) => i.category)).size;
    notify(isEdit ? "Receipt updated." : `Saved. ${receipt.items.length} items in ${cats} ${cats === 1 ? "category" : "categories"}.`);
    go(isEdit ? { name: "detail", id: id! } : { name: "home" });
  }

  return (
    <div className="stack pad">
      <header className="head-row">
        <button type="button" className="icon-btn" aria-label="Back" onClick={() => go(isEdit ? { name: "detail", id: draft.id! } : { name: "scan" })}>
          <Icon name="back" />
        </button>
        <h1 className="h-small">{isEdit ? "Edit receipt" : "Check and save"}</h1>
      </header>

      <section className="card form">
        <div className="summary">
          {preview && <img className="thumb" src={preview} alt="Receipt photo" />}
          <div className="fields">
            <label>
              <span>Shop</span>
              <input value={draft.merchant} onChange={(e) => set({ merchant: e.target.value })} placeholder="Shop name" />
            </label>
            <div className="two">
              <label>
                <span>Date</span>
                <input type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} />
              </label>
              <label>
                <span>Paid by</span>
                <input value={draft.paymentMethod ?? ""} onChange={(e) => set({ paymentMethod: e.target.value || undefined })} placeholder="Card" />
              </label>
            </div>
          </div>
        </div>
      </section>

      {unsure > 0 && (
        <p className="notice notice-warn">
          <Icon name="alert" />
          <span>{unsure === 1 ? "1 item needs a quick look." : `${unsure} items need a quick look.`} Tap Personal or Business to confirm.</span>
        </p>
      )}

      <div className="items">
        {draft.items.map((item, n) => (
          <div key={n} className={item.flag ? "item flagged" : "item"}>
            <div className="item-top">
              <input
                className="item-name"
                aria-label="Item name"
                value={item.name}
                placeholder="Item"
                onChange={(e) => setItem(n, { name: e.target.value })}
              />
              <input
                className="item-amount"
                aria-label="Amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                value={Number.isNaN(item.amount) ? "" : item.amount}
                onChange={(e) => setItem(n, { amount: parseFloat(e.target.value) || 0 })}
              />
              <button type="button" className="icon-btn small" aria-label={`Remove ${item.name || "item"}`} onClick={() => removeItem(n)}>
                <Icon name="x" size={16} />
              </button>
            </div>
            {item.flag && (
              <p className="flag"><Icon name="alert" size={16} />{item.flag}</p>
            )}
            <div className="item-bottom">
              <select
                aria-label="Category"
                value={item.category}
                onChange={(e) => {
                  const category = e.target.value;
                  setItem(n, { category, wallet: BUSINESS_CATEGORIES.has(category) ? "business" : item.wallet });
                }}
              >
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <div role="group" aria-label="Personal or business" className="toggle">
                <button type="button" aria-pressed={item.wallet === "personal"} className={item.wallet === "personal" ? "on-p" : ""} onClick={() => setItem(n, { wallet: "personal" })}>Personal</button>
                <button type="button" aria-pressed={item.wallet === "business"} className={item.wallet === "business" ? "on-b" : ""} onClick={() => setItem(n, { wallet: "business" })}>Business</button>
              </div>
            </div>
          </div>
        ))}
        <button type="button" className="btn ghost" onClick={addItem}><Icon name="plus" size={18} /> Add item</button>
      </div>

      <section className="card totals">
        <div><span>Personal</span><b>{money(personal, currency)}</b></div>
        <div><span>Business</span><b>{money(business, currency)}</b></div>
        <div className="grand"><span>Total</span><b>{money(total, currency)}</b></div>
        {mismatch && (
          <p className="flag"><Icon name="alert" size={16} />The receipt says {money(draft.printedTotal!, currency)}. Check the amounts above.</p>
        )}
      </section>

      <section className="card form">
        <label>
          <span>Note</span>
          <input value={draft.note ?? ""} onChange={(e) => set({ note: e.target.value || undefined })} placeholder="e.g. Lunch with a client" />
        </label>
        <label>
          <span>Warranty or return until (optional)</span>
          <input type="date" value={draft.warrantyUntil ?? ""} onChange={(e) => set({ warrantyUntil: e.target.value || undefined })} />
        </label>
      </section>

      {error && <p className="notice notice-error" role="alert"><Icon name="alert" /><span>{error}</span></p>}

      <button type="button" className="btn primary big" disabled={saving} onClick={save}>
        <Icon name="check" /> {isEdit ? "Save changes" : "Save receipt"}
      </button>
    </div>
  );
}
