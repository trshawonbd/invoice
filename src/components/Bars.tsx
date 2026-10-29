import { money, useSettings } from "../lib/settings";
import type { CategoryTotal } from "../lib/stats";

export function CategoryBars({ totals }: { totals: CategoryTotal[] }) {
  const { currency } = useSettings();
  const max = totals[0]?.amount ?? 1;
  if (!totals.length) return <p className="muted">Nothing spent in this period.</p>;
  return (
    <div className="bars">
      {totals.map((c) => (
        <div key={c.category} className="bar-row">
          <div className="bar-label">
            <span>{c.category}</span>
            <span className="amount">{money(c.amount, currency)}</span>
          </div>
          <div className="bar-track">
            <div
              className={c.mostlyBusiness ? "bar-fill biz" : "bar-fill"}
              style={{ width: `${Math.max(3, (c.amount / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
