import { useSyncExternalStore } from "react";

export interface Settings {
  apiKey: string;
  currency: string;
  /** Monthly personal budget per category. */
  budgets: Record<string, number>;
}

const KEY = "receipt-money-settings";
const DEFAULTS: Settings = { apiKey: "", currency: "€", budgets: { Groceries: 250, "Eating out": 100, Cigarettes: 40 } };

let current: Settings = load();
const listeners = new Set<() => void>();

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Private mode or storage full: keep the settings for this session only.
  }
  listeners.forEach((l) => l());
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}

export function money(amount: number, currency: string): string {
  const sign = amount < 0 ? "−" : "";
  return sign + currency + Math.abs(amount).toFixed(2);
}
