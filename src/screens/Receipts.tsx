import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Icon } from "../components/Icon";
import { ReceiptRow } from "../components/ReceiptRow";
import { Segmented, WALLET_OPTIONS, type WalletFilter } from "../components/Segmented";
import { db } from "../lib/db";
import { prettyDate, RANGES, rangeStart, type Range } from "../lib/dates";
import type { View } from "../lib/draft";
import { money, useSettings } from "../lib/settings";
import { itemsOf, sum } from "../lib/stats";
import type { Receipt } from "../lib/types";

interface Props {
  go: (v: View) => void;
  wallet: WalletFilter;
  setWallet: (w: WalletFilter) => void;
  range: Range;
  setRange: (r: Range) => void;
}

export function Receipts({ go, wallet, setWallet, range, setRange }: Props) {
  const { currency } = useSettings();
  const [query, setQuery] = useState("");
  const start = rangeStart(range);
  const inRange = useLiveQuery(
    () => (start ? db.receipts.where("date").aboveOrEqual(start) : db.receipts.toCollection()).reverse().sortBy("date"),
    [start],
  );

  const q = query.trim().toLowerCase();
  const shown = (inRange ?? []).filter((r) => {
    if (wallet !== "all" && !r.items.some((i) => i.wallet === wallet)) return false;
    if (!q) return true;
    const text = [r.merchant, r.note ?? "", ...r.items.flatMap((i) => [i.name, i.category])].join(" ").toLowerCase();
    return text.includes(q);
  });

  const groups: { date: string; receipts: Receipt[] }[] = [];
  for (const r of shown) {
    const last = groups[groups.length - 1];
    if (last?.date === r.date) last.receipts.push(r);
    else groups.push({ date: r.date, receipts: [r] });
  }

  return (
    <div className="stack pad">
      <header className="head">
        <h1>Receipts</h1>
        <p className="eyebrow">
          {shown.length} {shown.length === 1 ? "receipt" : "receipts"} · {money(sum(itemsOf(shown, wallet)), currency)}
        </p>
      </header>

      <label className="search">
        <Icon name="search" size={18} />
        <span className="sr-only">Search receipts</span>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search shop, item or category" />
      </label>

      <Segmented label="Time period" options={RANGES} value={range} onChange={setRange} small />
      <Segmented label="Wallet" options={WALLET_OPTIONS} value={wallet} onChange={setWallet} />

      {inRange && shown.length === 0 && (
        <p className="muted empty">{q ? "No receipts match your search." : "No receipts in this period."}</p>
      )}

      {groups.map((g) => (
        <section key={g.date} className="card card-list">
          <h2 className="group-head">{prettyDate(g.date)}</h2>
          {g.receipts.map((r) => (
            <ReceiptRow key={r.id} receipt={r} showDate={false} onOpen={() => go({ name: "detail", id: r.id! })} />
          ))}
        </section>
      ))}
    </div>
  );
}
