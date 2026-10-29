export const CATEGORIES = [
  "Groceries",
  "Cigarettes",
  "Eating out",
  "Transport",
  "Fuel",
  "Household",
  "Health",
  "Clothing",
  "Electronics",
  "Bills & utilities",
  "Entertainment",
  "Office supplies",
  "Client meals",
  "Business travel",
  "Software & subscriptions",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Categories that are business by default. Anything else starts as personal. */
export const BUSINESS_CATEGORIES = new Set<string>([
  "Office supplies",
  "Client meals",
  "Business travel",
  "Software & subscriptions",
]);
