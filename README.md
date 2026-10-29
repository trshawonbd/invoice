# Receipt Money

A phone-first money app. Scan or upload a receipt, and Claude reads it: the shop, the date and every item, each sorted into a category (groceries, cigarettes, office supplies…) and marked **Personal** or **Business**. Every receipt is kept with its photo, so the app is also your receipt vault.

## What it does

- **Add receipts** by scanning with the camera, uploading a photo or PDF, or typing one in.
- **Check and save**: fix anything before saving. Items Claude is unsure about are highlighted. Your corrections are remembered, so the same item is sorted your way next time.
- **Home**: this month's spending, the personal/business split, top categories, and warranties ending soon.
- **Receipts**: search, filter by Today / 7 days / 1 month / 3 months / All and by Personal / Business, and open any receipt to see its photo.
- **Insights**: spending by category, a cigarette habit tracker with a yearly projection, monthly budgets, and a CSV export of business spending for your accountant.
- Works as an installable app (PWA). Data stays in the browser on your device.

## Run it

```bash
npm install
npm run dev      # open the printed address; use your phone on the same Wi-Fi with --host
npm run build    # production build in dist/
```

In the app, open **Settings** and paste a Claude API key from https://console.anthropic.com. The key is stored only on your device and is sent only to Anthropic when a receipt is read.

## Notes

- Receipts are read by `claude-opus-5-5` (see `src/lib/claude.ts`).
- Because the app calls the Claude API straight from the browser with your own key, it is meant for personal use. To share it with other people, move that call to a small server so the key is never in the browser.
- The previous invoice generator is kept in `legacy-invoice/`.
