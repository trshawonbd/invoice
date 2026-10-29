import { useState } from "react";
import { Icon, type IconName } from "./components/Icon";
import type { WalletFilter } from "./components/Segmented";
import type { Range } from "./lib/dates";
import type { View } from "./lib/draft";
import { Home } from "./screens/Home";
import { Insights } from "./screens/Insights";
import { ReceiptDetail } from "./screens/ReceiptDetail";
import { Receipts } from "./screens/Receipts";
import { Review } from "./screens/Review";
import { Scan } from "./screens/Scan";
import { SettingsScreen } from "./screens/Settings";

const TABS: { name: "home" | "scan" | "receipts" | "insights"; label: string; icon: IconName }[] = [
  { name: "home", label: "Home", icon: "home" },
  { name: "scan", label: "Scan", icon: "camera" },
  { name: "receipts", label: "Receipts", icon: "receipt" },
  { name: "insights", label: "Insights", icon: "chart" },
];

export function App() {
  const [view, setView] = useState<View>({ name: "home" });
  const [wallet, setWallet] = useState<WalletFilter>("all");
  const [range, setRange] = useState<Range>("1m");
  const [toast, setToast] = useState("");

  const go = (v: View) => {
    setView(v);
    window.scrollTo(0, 0);
  };
  const notify = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 3000);
  };

  const activeTab = view.name === "detail" ? "receipts" : view.name === "review" ? "scan" : view.name;
  const filters = { wallet, setWallet, range, setRange };

  return (
    <div className="app">
      <main className="screen">
        {view.name === "home" && <Home go={go} wallet={wallet} setWallet={setWallet} />}
        {view.name === "scan" && <Scan go={go} />}
        {view.name === "review" && <Review key={view.draft.id ?? "new"} view={view} go={go} notify={notify} />}
        {view.name === "receipts" && <Receipts go={go} {...filters} />}
        {view.name === "detail" && <ReceiptDetail id={view.id} go={go} notify={notify} />}
        {view.name === "insights" && <Insights {...filters} />}
        {view.name === "settings" && <SettingsScreen go={go} notify={notify} />}
      </main>

      {toast && (
        <div className="toast" role="status">
          <span className="toast-check"><Icon name="check" size={16} /></span>
          {toast}
        </div>
      )}

      <nav className="tabs" aria-label="Main">
        {TABS.map((t) => (
          <button
            key={t.name}
            type="button"
            className={activeTab === t.name ? "tab on" : "tab"}
            aria-current={activeTab === t.name ? "page" : undefined}
            onClick={() => go({ name: t.name })}
          >
            {t.name === "scan" ? (
              <span className="tab-scan"><Icon name="camera" /></span>
            ) : (
              <Icon name={t.icon} size={22} />
            )}
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
