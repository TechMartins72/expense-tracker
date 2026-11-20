# Expense Tracker

A personal Android app for logging income and expenses in ₦ and $. It splits every income into savings (25%), tithe (10%) and investment (10%), and helps you stick to a monthly budget. It works fully offline, and everything is stored on the phone.

## What's in it

- **Quick entry** (the + button): expense or income, a big number pad, a ₦/$ switch that remembers your last choice, and categories sorted by how often you use them. For income it shows a live preview of the split. Most entries are just the amount and Save.
- **Overview**: money left to spend this month (in ₦ or $), progress rings for the three buckets, a spending donut, one insight at a time, your logging streak, and the last five entries.
- **Buckets**: what's pending and what's set aside in each bucket. Mark an allocation done, or record that you moved part of it.
- **Budgets**: a monthly limit per category, with warnings at 80% and 100%. A limit carries over to the next months until you change it.
- **Activity**: every entry, filtered by month, type, currency and category. Tap an entry to edit or delete it.
- **Settings**: bucket percentages (they apply to new income only), categories, default currency, theme (system, light or dark) and the exchange rate (fetched live, or entered by you).
- **Weekly review** (Friday to Sunday): the week's totals, and a quick way to settle pending allocations.

## Run it

You need Node 22+ and an Android phone with [Expo Go](https://expo.dev/go), or an emulator.

```bash
npm install
npm start        # scan the QR code with Expo Go
npm test         # unit and database tests
npm run typecheck
```

To get an installable APK, use EAS Build (`npx eas-cli@latest build -p android --profile preview`, which needs a free Expo account) or build locally with `npx expo run:android` (which needs the Android SDK).

## Design

The colours, fonts (Plus Jakarta Sans and Michroma) and corner radii come from Stow. The tokens live in `src/theme/tokens.ts`.
