import { useLiveQuery } from "dexie-react-hooks";
import { CategoryBars } from "../components/Bars";
import { Icon } from "../components/Icon";
import { ReceiptRow } from "../components/ReceiptRow";
import { Segmented, WALLET_OPTIONS, type WalletFilter } from "../components/Segmented";
import { db } from "../lib/db";
import { isoDate, prettyDate, startOfMonth, today } from "../lib/dates";
import type { View } from "../lib/draft";
import { money, useSettings } from "../lib/settings";
import { byCategory, itemsOf, sum } from "../lib/stats";

interface Props {
  go: (v: View) => void;
  wallet: WalletFilter;
  setWallet: (w: WalletFilter) => void;
}

const LABELS: Record<WalletFilter, string> = {
  all: "Spent this month",
  personal: "Personal spending this month",
  business: "Business spending this month",
};

export function Home({ go, wallet, setWallet }: Props) {
  const { currency, apiKey } = useSettings();
  const month = useLiveQuery(() => db.receipts.where("date").aboveOrEqual(startOfMonth()).toArray(), []);
  const recent = useLiveQuery(() => db.receipts.orderBy("date").reverse().limit(5).toArray(), []);
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);
  const reminders = useLiveQuery(
    () => db.receipts.filter((r) => !!r.warrantyUntil && r.warrantyUntil >= today() && r.warrantyUntil <= isoDate(soon)).toArray(),
    [],
  );

  const monthReceipts = month ?? [];
  const items = itemsOf(monthReceipts, wallet);
  const personal = sum(itemsOf(monthReceipts, "personal"));
  const business = sum(itemsOf(monthReceipts, "business"));
  const both = personal + business || 1;
  const monthName = new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="stack pad">
      <header className="head">
        <div>
          <p className="eyebrow">{monthName}</p>
          <h1>Your money</h1>
        </div>
        <button type="button" className="icon-btn" aria-label="Settings" onClick={() => go({ name: "settings" })}>
          <Icon name="settings" />
        </button>
      </header>

      {!apiKey && (
        <button type="button" className="notice" onClick={() => go({ name: "settings" })}>
          <Icon name="alert" />
          <span>Add your Claude API key in Settings so the app can read your receipts.</span>
        </button>
      )}

      <Segmented label="Wallet" options={WALLET_OPTIONS} value={wallet} onChange={setWallet} />

      <section className="hero">
        <p className="hero-label">{LABELS[wallet]}</p>
        <p className="hero-amount">{money(sum(items), currency)}</p>
        <div className="split" aria-hidden="true">
          <div style={{ width: `${(personal / both) * 100}%` }} className="split-p" />
          <div style={{ width: `${(business / both) * 100}%` }} className="split-b" />
        </div>
        <div className="legend">
          <span><i className="dot dot-p" />Personal <b>{money(personal, currency)}</b></span>
          <span><i className="dot dot-b" />Business <b>{money(business, currency)}</b></span>
        </div>
      </section>

      <button type="button" className="cta" onClick={() => go({ name: "scan" })}>
        <span className="cta-icon"><Icon name="camera" size={24} /></span>
        <span className="cta-text">
          <b>Scan a receipt</b>
          <span>We read it and sort every item for you</span>
        </span>
        <Icon name="chevron" />
      </button>

      {(reminders ?? []).map((r) => (
        <button key={r.id} type="button" className="reminder" onClick={() => go({ name: "detail", id: r.id! })}>
          <Icon name="shield" size={22} />
          <span>
            <b>{r.merchant}: warranty ends {prettyDate(r.warrantyUntil!)}</b>
            <span>Tap to see the receipt</span>
          </span>
        </button>
      ))}

      <section className="card">
        <div className="card-head">
          <h2>Top categories</h2>
          <button type="button" className="link" onClick={() => go({ name: "insights" })}>See all</button>
        </div>
        <CategoryBars totals={byCategory(items).slice(0, 4)} />
      </section>

      <section className="card card-list">
        <div className="card-head">
          <h2>Recent receipts</h2>
          <button type="button" className="link" onClick={() => go({ name: "receipts" })}>All receipts</button>
        </div>
        {recent && recent.length === 0 && <p className="muted empty">No receipts yet. Scan your first one.</p>}
        {(recent ?? []).map((r) => (
          <ReceiptRow key={r.id} receipt={r} onOpen={() => go({ name: "detail", id: r.id! })} />
        ))}
      </section>
    </div>
  );
}
