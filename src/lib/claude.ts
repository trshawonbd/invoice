import Anthropic from "@anthropic-ai/sdk";
import { BUSINESS_CATEGORIES, CATEGORIES } from "./categories";
import { applyRules, db } from "./db";
import { today } from "./dates";
import type { Prepared } from "./image";
import type { Item, Wallet } from "./types";

export interface ReadResult {
  merchant: string;
  date: string;
  printedTotal?: number;
  paymentMethod?: string;
  items: Item[];
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["is_receipt", "merchant", "date", "total", "payment_method", "items"],
  properties: {
    is_receipt: { type: "boolean", description: "False if the picture is not a receipt or invoice." },
    merchant: { type: "string", description: "Shop or company name as printed, in normal capitalisation." },
    date: { type: "string", description: "Purchase date as YYYY-MM-DD, or empty string if unreadable." },
    total: { type: "number", description: "Grand total paid, or 0 if unreadable." },
    payment_method: { type: "string", description: "Cash, Card, Mobile or empty string." },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "amount", "category", "wallet", "unsure_reason"],
        properties: {
          name: { type: "string" },
          amount: { type: "number", description: "Line total after quantity and line discounts." },
          category: { type: "string", enum: [...CATEGORIES] },
          wallet: { type: "string", enum: ["personal", "business"] },
          unsure_reason: {
            type: "string",
            description: "Empty if confident. Otherwise one short question for the user.",
          },
        },
      },
    },
  },
};

const SYSTEM = `You read photos and PDFs of shopping receipts and invoices for a personal money app.

Return every purchased line as an item. Write item names short and readable in English (keep brand names), e.g. "CIG MRLB RED 20" becomes "Cigarettes (20)". Use the line total, so "2 x 1.50" is 3.00. Put receipt-wide discounts as an item with a negative amount. Leave out subtotal, tax and change lines unless tax is not already included in the item prices, in which case add one "Tax" item.

Pick the closest category for each item. Tobacco, cigarettes, vapes and rolling papers are always "Cigarettes".

The user keeps personal and business spending apart. Choose "business" only when the item is clearly for work: ${[...BUSINESS_CATEGORIES].join(", ")}, or the receipt is a company invoice. Everything else is "personal". When an item could be either way, keep your best guess and set unsure_reason to a short question, e.g. "Is this printer paper for work?". Also use unsure_reason when a price or name is hard to read.

The date may be printed in any format; today is ${today()}, so use that to resolve the year and day/month order.`;

export class ReadError extends Error {}

export async function readReceipt(file: Prepared, apiKey: string): Promise<ReadResult> {
  if (!apiKey) throw new ReadError("Add your Claude API key in Settings to read receipts.");

  // This app keeps the key on the user's own device, so calling from the browser is intended.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const remembered = await db.rules.limit(40).toArray();
  const hints = remembered.length
    ? `\n\nThe user corrected these items before; use the same choices for them:\n${remembered
        .map((r) => `- ${r.key}: ${r.category}, ${r.wallet}`)
        .join("\n")}`
    : "";

  const fileBlock: Anthropic.Beta.BetaContentBlockParam =
    file.kind === "pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: file.base64 } }
      : { type: "image", source: { type: "base64", media_type: "image/jpeg", data: file.base64 } };

  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM + hints,
      messages: [{ role: "user", content: [fileBlock, { type: "text", text: "Read this receipt." }] }],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new ReadError("Your API key was not accepted. Check it in Settings.");
    if (err instanceof Anthropic.RateLimitError) throw new ReadError("Too many scans at once. Wait a minute and try again.");
    if (err instanceof Anthropic.APIConnectionError) throw new ReadError("No connection. Check your internet and try again.");
    if (err instanceof Anthropic.APIError) throw new ReadError(`Claude could not read it (${err.status ?? "error"}). Try again.`);
    throw err;
  }

  if (response.stop_reason === "refusal") throw new ReadError("This picture could not be read. Try another photo.");
  if (response.stop_reason === "max_tokens") throw new ReadError("This receipt is too long to read in one go.");

  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new ReadError("No answer came back. Try again.");

  const data = JSON.parse(text.text) as {
    is_receipt: boolean;
    merchant: string;
    date: string;
    total: number;
    payment_method: string;
    items: { name: string; amount: number; category: string; wallet: Wallet; unsure_reason: string }[];
  };

  if (!data.is_receipt) throw new ReadError("That doesn't look like a receipt. Try again with the whole receipt in view.");

  const items = await applyRules(
    data.items.map((i) => ({
      name: i.name,
      amount: Math.round(i.amount * 100) / 100,
      category: i.category,
      wallet: i.wallet,
      flag: i.unsure_reason || undefined,
    })),
  );

  return {
    merchant: data.merchant || "Unknown shop",
    date: /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? data.date : today(),
    printedTotal: data.total > 0 ? data.total : undefined,
    paymentMethod: data.payment_method || undefined,
    items,
  };
}
