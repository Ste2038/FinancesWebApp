# FinancesWebApp

Personal finance web app for desktop and mobile. The goal is to provide a clear view of your financial situation, import and reconcile data from the SQLite database exported by the phone app, and expose dashboards, charts, and Telegram-based actions.

## What This Project Does

- Tracks the financial picture across accounts, groups, categories, and expenses.
- Imports another SQLite database from the phone app and shows detected differences before applying changes.
- Prevents duplicate imports through source identifiers and deterministic matching.
- Provides responsive pages for balances, transaction history, and analytics.
- Supports Telegram commands for adding an expense and checking the current situation.

## Repository Structure

The codebase is intentionally split into a few clear areas:

- `app/` for Next.js pages and route handlers.
- `components/` for shared UI pieces such as charts, tables, forms, and mobile layouts.
- `lib/db/` for SQLite access, schema, migrations, repositories, and typed queries.
- `lib/domain/` for business rules around accounts, categories, transactions, and imports.
- `lib/importers/` for parsing the phone SQLite file, normalizing rows, diffing, and applying imports.
- `lib/analytics/` for time-series and grouped finance queries.
- `lib/telegram/` for bot authorization and message handling.
- `tests/` for unit, integration, and end-to-end coverage.
- `scripts/` for local database and schema utilities.
- `data/` for local-only runtime data such as the live application SQLite file and uploaded imports.

## Target Database Structure

The application database is SQLite and is designed around a normalized finance model.

Core tables:

- `users`: minimal user table for future expansion; v1 is single-owner.
- `account_groups`: groups of accounts, matching the phone app's account grouping concept.
- `accounts`: individual accounts, such as bank, cash, or card-backed money containers.
- `categories`: hierarchical income and expense categories.
- `transactions`: normalized ledger entries for expenses, income, and transfers.
- `import_batches`: one record per uploaded source SQLite file.
- `import_candidates`: diff rows generated during import review, with the chosen action.

Key design rules:

- Keep source `uid` values from the imported phone database whenever available.
- Add a deterministic fingerprint so repeated uploads can be matched safely.
- Use soft deletes for imported data so reconciliation stays auditable.
- Store the live SQLite file in a local ignored folder, not in the tracked repository.

## Source SQLite Schema Summary

The bundled phone export, `money_android.sqlite`, is used only as a schema reference for this project. It should not be committed as a public runtime asset.

The important source tables are:

- `ASSETGROUP`: account groups.
- `ASSETS`: individual accounts and account metadata.
- `ZCATEGORY`: category tree and category metadata.
- `INOUTCOME`: transaction ledger entries, including amounts, dates, categories, and account references.

Other tables in the phone export exist for app-specific features such as budgets, tags, photos, SMS parsing, memo data, repeat transactions, and sync metadata. Those are not part of the v1 target model unless a later feature needs them.

Observed source table sizes from the bundled export:

- `ASSETGROUP`: 12 rows
- `ASSETS`: 19 rows
- `ZCATEGORY`: 82 rows
- `INOUTCOME`: 1904 rows

## Import Workflow

1. Upload a phone SQLite file.
2. Parse supported source tables into normalized staging data.
3. Compare the staging data against the local database.
4. Show additions, changes, deletions, and unchanged rows.
5. Let the user choose what to add, keep, update, or mark deleted.
6. Apply the selected actions in a single transaction.

The import flow must not write directly into the main tables before review.

## Telegram

Telegram is part of the control surface for the project.

- Configure the bot token and the allowed chat or user IDs in local ignored environment files.
- Accept commands to add an expense.
- Accept commands to report the current financial situation.
- Reject messages from unauthorized IDs.

## Local Setup

This repository is public, so private configuration must stay local.

Required local files:

- `.env.local` for secrets and machine-specific paths.
- `data/app.sqlite` or another local SQLite path for the live database.
- `data/uploads/` or another local directory for uploaded phone databases.

The repository includes `.env.example` as the safe template for required variables.

Suggested environment variables:

- `DATABASE_URL` or `SQLITE_PATH`
- `UPLOADS_DIR`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ALLOWED_IDS`
- `TELEGRAM_WEBHOOK_SECRET`
