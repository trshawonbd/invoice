import { prettyDate } from "../lib/dates";
import { money, useSettings } from "../lib/settings";
import { categoryLabel, kindOf, sum } from "../lib/stats";
import type { Receipt } from "../lib/types";
import { Icon } from "./Icon";

export function KindPill({ kind }: { kind: string }) {
  return <span className={`pill pill-${kind.toLowerCase()}`}>{kind}</span>;
}

export function ReceiptRow({ receipt, onOpen, showDate = true }: { receipt: Receipt; onOpen: () => void; showDate?: boolean }) {
  const { currency } = useSettings();
  return (
    <button type="button" className="row" onClick={onOpen}>
      <span className="row-badge" aria-hidden="true">{receipt.merchant.charAt(0).toUpperCase()}</span>
      <span className="row-main">
        <span className="row-title">{receipt.merchant}</span>
        <span className="row-sub">
          {showDate ? `${prettyDate(receipt.date)} · ` : ""}
          {categoryLabel(receipt)}
        </span>
        {receipt.warrantyUntil && (
          <span className="row-warranty">
            <Icon name="shield" size={13} /> Warranty saved
          </span>
        )}
      </span>
      <span className="row-end">
        <span className="amount">{money(sum(receipt.items), currency)}</span>
        <KindPill kind={kindOf(receipt)} />
      </span>
    </button>
  );
}
