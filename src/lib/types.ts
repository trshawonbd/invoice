export type Wallet = "personal" | "business";

export interface Item {
  name: string;
  amount: number;
  category: string;
  wallet: Wallet;
  /** Set when the AI was unsure about this line, with a short reason for the user. */
  flag?: string;
}

export interface Receipt {
  id?: number;
  merchant: string;
  /** ISO date, YYYY-MM-DD */
  date: string;
  /** Total printed on the receipt, when it was readable. */
  printedTotal?: number;
  paymentMethod?: string;
  items: Item[];
  note?: string;
  /** ISO date the warranty or return period ends. */
  warrantyUntil?: string;
  image?: Blob;
  createdAt: number;
}

/** A remembered correction: next time an item with this name shows up, use these. */
export interface Rule {
  key: string;
  category: string;
  wallet: Wallet;
}
