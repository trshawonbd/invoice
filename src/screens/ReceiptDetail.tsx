import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { Icon } from "../components/Icon";
import { KindPill } from "../components/ReceiptRow";
import { db } from "../lib/db";
import { prettyDate } from "../lib/dates";
import type { View } from "../lib/draft";
import { downloadBlob, receiptFileName } from "../lib/export";
import { money, useSettings } from "../lib/settings";
import { kindOf, sum } from "../lib/stats";

interface Props {
  id: number;
  go: (v: View) => void;
  notify: (message: string) => void;
}

export function ReceiptDetail({ id, go, notify }: Props) {
  const { currency } = useSettings();
  const receipt = useLiveQuery(() => db.receipts.get(id), [id]);
  const [photo, setPhoto] = useState<string>();
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    if (!receipt?.image) return;
    const url = URL.createObjectURL(receipt.image);
    setPhoto(url);
    return () => URL.revokeObjectURL(url);
  }, [receipt?.image]);

  if (receipt === undefined) return <div className="pad muted">Loading…</div>;
  if (!receipt) {
    return (
      <div className="stack pad">
        <p className="muted">This receipt was deleted.</p>
        <button type="button" className="btn" onClick={() => go({ name: "receipts" })}>Back to receipts</button>
      </div>
    );
  }

  const isPdf = receipt.image?.type === "application/pdf";

  async function remove() {
    if (!confirm(`Delete the ${receipt!.merchant} receipt? This cannot be undone.`)) return;
    await db.receipts.delete(id);
    notify("Receipt deleted.");
    go({ name: "receipts" });
  }

  return (
    <div className="stack pad">
      <header className="head-row">
        <button type="button" className="icon-btn" aria-label="Back to receipts" onClick={() => go({ name: "receipts" })}>
          <Icon name="back" />
        </button>
        <h1 className="h-small grow">{receipt.merchant}</h1>
        <KindPill kind={kindOf(receipt)} />
      </header>

      {photo && !isPdf && (
        <button type="button" className={zoom ? "photo zoom" : "photo"} onClick={() => setZoom(!zoom)} aria-label={zoom ? "Shrink photo" : "Enlarge photo"}>
          <img src={photo} alt={`Receipt from ${receipt.merchant}`} />
        </button>
      )}
      {isPdf && photo && (
        <a className="btn" href={photo} target="_blank" rel="noreferrer"><Icon name="receipt" size={18} /> Open the PDF</a>
      )}

      <section className="card">
        <p className="meta">
          {prettyDate(receipt.date)}
          {receipt.paymentMethod ? ` · ${receipt.paymentMethod}` : ""}
        </p>
        <div className="lines">
          {receipt.items.map((i, n) => (
            <div key={n} className="line">
              <span className="line-main">
                <span className="line-name">{i.name}</span>
                <span className="line-tags">
                  <span className="pill">{i.category}</span>
                  <KindPill kind={i.wallet === "business" ? "Business" : "Personal"} />
                </span>
              </span>
              <span className="amount">{money(i.amount, currency)}</span>
            </div>
          ))}
          <div className="line total-line">
            <span>Total</span>
            <span className="amount">{money(sum(receipt.items), currency)}</span>
          </div>
        </div>
      </section>

      {receipt.note && <p className="card note"><b>Note:</b> {receipt.note}</p>}

      {receipt.warrantyUntil && (
        <div className="reminder static">
          <Icon name="shield" size={22} />
          <span>
            <b>Warranty or return until {prettyDate(receipt.warrantyUntil)}</b>
            <span>It shows on your home screen in the last 30 days.</span>
          </span>
        </div>
      )}

      <div className="actions">
        <button type="button" className="btn" onClick={() => go({ name: "review", draft: receipt })}>
          <Icon name="pen" size={18} /> Edit
        </button>
        {receipt.image && (
          <button type="button" className="btn" onClick={() => downloadBlob(receipt.image!, receiptFileName(receipt, isPdf ? "pdf" : "jpg"))}>
            <Icon name="download" size={18} /> Save
          </button>
        )}
        <button type="button" className="btn danger" onClick={remove}>
          <Icon name="trash" size={18} /> Delete
        </button>
      </div>
    </div>
  );
}
