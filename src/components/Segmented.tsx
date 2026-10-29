interface Props<T extends string> {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  small?: boolean;
}

export function Segmented<T extends string>({ label, options, value, onChange, small }: Props<T>) {
  return (
    <div role="group" aria-label={label} className={small ? "seg seg-small" : "seg"}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={o.id === value}
          className={o.id === value ? "on" : ""}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export type WalletFilter = "all" | "personal" | "business";

export const WALLET_OPTIONS: { id: WalletFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "personal", label: "Personal" },
  { id: "business", label: "Business" },
];
