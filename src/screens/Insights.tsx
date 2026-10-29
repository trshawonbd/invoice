import { useLiveQuery } from "dexie-react-hooks";
import { CategoryBars } from "../components/Bars";
import { Icon } from "../components/Icon";
import { Segmented, WALLET_OPTIONS, type WalletFilter } from "../components/Segmented";
import { db } from "../lib/db";
import { RANGES, rangeDays, rangeStart, startOfMonth, type Range } from "../lib/dates";
import { downloadCsv } from "../lib/export";
import { money, useSettings } from "../lib/settings";
import { byCategory, itemsOf, sum } from "../lib/stats";

interface Props {
  wallet: WalletFilter;
  setWallet: (w: WalletFilter) => void;
  range: Range;
  setRange: (r: Range) => void;
}

export function Insights({ wallet, setWallet, range, setRange }: Props) {
  const { currency, budgets } = useSettings();
  const start = rangeStart(range);
  const receipts = useLiveQuery(
    () => (start ? db.receipts.where("date").aboveOrEqual(start).toArray() : db.receipts.toArray()),
    [start],
  ) ?? [];
  const month = useLiveQuery(() => db.receipts.where("date").aboveOrEqual(startOfMonth()).toArray(), []) ?? [];

  const items = itemsOf(receipts, wallet);
  const earliest = receipts.reduce<string | undefined>((min, r) => (!min || r.date < min ? r.date : min), undefined);
  const days = rangeDays(range, earliest);

  const cigs = sum(itemsOf(receipts).filter((i) => i.category === "Cigarettes"));
  const cigYear = (cigs / days) * 365;

  const business = receipts.filter((r) => r.items.some((i) => i.wallet === "business"));
  const businessTotal = sum(itemsOf(receipts, "business"));
  const rangeLabel = RANGES.find((r) => r.id === range)!.label.toLowerCase();

  const monthPersonal = itemsOf(month, "personal");
  const budgetRows = Object.entries(budgets).map(([category, limit]) => {
    const spent = sum(monthPersonal.filter((i) => i.category === category));
    const pct = limit > 0 ? (spent / limit) * 100 : 0;
    const status = pct >= 100 ? "over" : pct >= 80 ? "near" : "ok";
    return { category, limit, spent, pct, status };
  });

  return (
    <div className="stack pad">
      <h1>Insights</h1>
      <Segmented label="Time period" options={RANGES} value={range} onChange={setRange} small />
      <Segmented label="Wallet" options={WALLET_OPTIONS} value={wallet} onChange={setWallet} />

      <section className="hero">
        <p className="hero-label">Spent · {rangeLabel === "all" ? "all time" : rangeLabel === "today" ? "today" : `last ${rangeLabel}`}</p>
        <p className="hero-amount">{money(sum(items), currency)}</p>
        <p className="hero-sub">{receipts.length} {receipts.length === 1 ? "receipt" : "receipts"} · about {money(sum(items) / days, currency)} a day</p>
      </section>

      {cigs > 0 && (
        <section className="habit">
          <p className="habit-label">Habit tracker · Cigarettes</p>
          <p className="habit-amount">{money(cigs, currency)}</p>
          <p>At this pace that is about <b>{money(cigYear, currency)}</b> a year.</p>
          <p className="habit-sub">Cutting it by a quarter keeps about {money(cigYear / 4, currency)} a year in your pocket.</p>
        </section>
      )}

      <section className="card">
        <h2>Where your money goes</h2>
        <CategoryBars totals={byCategory(items)} />
        <p className="legend-light">
          <span><i className="dot dot-p" />Mostly personal</span>
          <span><i className="dot dot-b" />Mostly business</span>
        </p>
      </section>

      {budgetRows.length > 0 && (
        <section className="card">
          <h2>Monthly budgets</h2>
          <div className="bars">
            {budgetRows.map((b) => (
              <div key={b.category} className="bar-row">
                <div className="bar-label">
                  <span><b>{b.category}</b></span>
                  <span className={`status status-${b.status}`}>
                    {b.status === "over" ? "Over budget" : b.status === "near" ? "Almost used up" : "On track"}
                  </span>
                </div>
                <div className="bar-track thick">
                  <div className={b.status === "ok" ? "bar-fill" : "bar-fill biz"} style={{ width: `${Math.max(3, Math.min(100, b.pct))}%` }} />
                </div>
                <span className="muted small">{money(b.spent, currency)} of {money(b.limit, currency)} this month</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="biz-card">
        <p className="biz-label">Business · {rangeLabel === "all" ? "all time" : rangeLabel}</p>
        <p className="biz-amount">{money(businessTotal, currency)}</p>
        <p>{business.length} {business.length === 1 ? "receipt" : "receipts"} with business items, ready for your accountant.</p>
        <button
          type="button"
          className="btn biz"
          disabled={!business.length}
          onClick={() => downloadCsv(business.map((r) => ({ ...r, items: r.items.filter((i) => i.wallet === "business") })), `business-${range}.csv`)}
        >
          <Icon name="download" size={18} /> Export for Excel (CSV)
        </button>
      </section>
    </div>
  );
}
