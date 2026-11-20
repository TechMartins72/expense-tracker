@AGENTS.md

# Expense Tracker

A personal Android app for recording income and expenses in naira (NGN) and US dollars (USD). Every income is split automatically into savings, tithe and investment buckets. It's tracking only: the app holds no money. It's separate from Stow (the crypto savings app), but it matches Stow's look.

Expo SDK 58, React Native 0.88, TypeScript, Expo Router (`src/app/`), expo-sqlite. **Android only** (`"platforms": ["android"]` in `app.json`).

## Commands

- `npm start` - Expo dev server (needs a development build or Expo Go on the phone)
- `npm test` - unit tests, plus repository tests against real SQLite (`node:sqlite`, Node 22+)
- `npm run typecheck`
- `npx expo export --platform android` - checks that the Android bundle builds
- `npx expo install <pkg>` - add a dependency (picks SDK-compatible versions). Use `--legacy-peer-deps` for plain `npm i` of dev tools (an Expo web peer conflict blocks it otherwise).

## Layout

- `src/app/` - routes only. `(tabs)/` holds Overview (`index`), Activity (`transactions`), Buckets, Budgets and Settings. Modals: `entry` (quick entry, `?id=` to edit) and `review` (weekly review). `categories` is pushed from Settings.
- `src/lib/` - pure, framework-free logic with tests: `money.ts` (parse, format, convert), `split.ts` (bucket split), `summary.ts` (monthly and bucket totals), `insights.ts` (offline rule-based tips), `streak.ts`, `dates.ts`.
- `src/db/` - `schema.ts` (migrations by `PRAGMA user_version`, plus seed data) and `repo.ts` (typed queries, with multi-row writes in one exclusive transaction).
- `src/state/AppState.tsx` - holds the db handle and settings. `changed()` after any write, and `useQuery()` reloads on focus and after writes.
- `src/theme/` - design tokens copied from Stow's `app/globals.css` (colours, Plus Jakarta Sans and Michroma, radii). Light is the main theme. Dark uses Stow's dark palette with brighter muted text and larger type.
- `src/components/` - shared UI (`ui.tsx`, `charts.tsx` built on react-native-svg, `Sheet`, `toast`, `TxnItem`, `Fab`).
- `src/features/` - feature loaders (`overview/`, `fx/`).

## Money rules (do not break these)

1. Amounts are integers in minor units (kobo or cents) everywhere, including the database. Parse user input with `parseMinor` and display with `formatMoney`. Never use `parseFloat` or float maths on an amount.
2. Exchange rates are integers: naira per dollar x 1000. Every transaction stores the rate from when it was entered, and conversions use that stored rate (`convert`). An edit keeps the original rate.
3. When income is logged, it gets one allocation per bucket. Each allocation is rounded down, and the remainder stays spendable. An allocation keeps the percentage it was created with, so changing bucket percentages affects future income only. You can't move more than an allocation is due.
4. Budgets and "left to spend" use only the spendable part of income.
5. A budget row applies from its month onward until another row replaces it. A limit of 0 means "no budget".
6. Write the test for a rule before changing the rule.

## Phases

- Phase 1 (this code): quick entry, the automatic split and buckets, budgets, the overview, transactions, settings, offline insights, the logging streak and the weekly review.
- Phase 2: AI suggestions from a small backend that calls the Claude API. The key stays on the server. Send only an anonymised monthly summary, never raw transactions, and cache the latest result. Also importing the "Payments Budget" Google Docs (April onward).
- Later: recurring expenses, receipt scanning, natural-language entry, CSV export, and possibly a real wallet linked with Stow.
