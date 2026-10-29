import { useState } from "react";
import { Icon } from "../components/Icon";
import { CATEGORIES } from "../lib/categories";
import { db } from "../lib/db";
import type { View } from "../lib/draft";
import { downloadCsv } from "../lib/export";
import { saveSettings, useSettings } from "../lib/settings";

const CURRENCIES = ["€", "৳", "$", "£", "₹"];

export function SettingsScreen({ go, notify }: { go: (v: View) => void; notify: (m: string) => void }) {
  const settings = useSettings();
  const [key, setKey] = useState(settings.apiKey);
  const [newBudget, setNewBudget] = useState<string>(CATEGORIES.find((c) => !(c in settings.budgets)) ?? "");

  const setBudget = (category: string, value: number | null) => {
    const budgets = { ...settings.budgets };
    if (value === null) delete budgets[category];
    else budgets[category] = value;
    saveSettings({ budgets });
  };

  async function exportAll() {
    downloadCsv(await db.receipts.toArray(), "all-receipts.csv");
  }

  async function wipe() {
    if (!confirm("Delete every receipt and photo on this device? This cannot be undone.")) return;
    await Promise.all([db.receipts.clear(), db.rules.clear()]);
    notify("All receipts deleted.");
  }

  return (
    <div className="stack pad">
      <header className="head-row">
        <button type="button" className="icon-btn" aria-label="Back" onClick={() => go({ name: "home" })}>
          <Icon name="back" />
        </button>
        <h1 className="h-small">Settings</h1>
      </header>

      <section className="card form">
        <h2>Claude API key</h2>
        <p className="muted small">
          The app sends each receipt photo to Claude to read it. Create a key at console.anthropic.com. The key stays on this
          device only.
        </p>
        <label>
          <span>API key</span>
          <input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-…" />
        </label>
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            saveSettings({ apiKey: key.trim() });
            notify("API key saved.");
          }}
        >
          Save key
        </button>
      </section>

      <section className="card form">
        <h2>Currency</h2>
        <div role="group" aria-label="Currency" className="seg">
          {CURRENCIES.map((c) => (
            <button key={c} type="button" aria-pressed={settings.currency === c} className={settings.currency === c ? "on" : ""} onClick={() => saveSettings({ currency: c })}>
              {c}
            </button>
          ))}
        </div>
      </section>

      <section className="card form">
        <h2>Monthly budgets (personal)</h2>
        {Object.entries(settings.budgets).map(([category, limit]) => (
          <div key={category} className="budget-row">
            <label className="grow">
              <span>{category}</span>
              <input type="number" inputMode="decimal" min="0" value={limit} onChange={(e) => setBudget(category, parseFloat(e.target.value) || 0)} />
            </label>
            <button type="button" className="icon-btn small" aria-label={`Remove ${category} budget`} onClick={() => setBudget(category, null)}>
              <Icon name="x" size={16} />
            </button>
          </div>
        ))}
        <div className="budget-row">
          <label className="grow">
            <span>Add a budget</span>
            <select value={newBudget} onChange={(e) => setNewBudget(e.target.value)}>
              {CATEGORIES.filter((c) => !(c in settings.budgets)).map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <button type="button" className="icon-btn small" aria-label="Add budget" disabled={!newBudget} onClick={() => { setBudget(newBudget, 100); setNewBudget(""); }}>
            <Icon name="plus" size={16} />
          </button>
        </div>
      </section>

      <section className="card form">
        <h2>Your data</h2>
        <p className="muted small">Receipts and photos are stored in this browser on this device. Export regularly to keep a backup.</p>
        <button type="button" className="btn" onClick={exportAll}><Icon name="download" size={18} /> Export all receipts (CSV)</button>
        <button type="button" className="btn danger" onClick={wipe}><Icon name="trash" size={18} /> Delete everything</button>
      </section>
    </div>
  );
}
