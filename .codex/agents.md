# Codex Working Notes

This file is local-only session memory for future Codex runs. It is intentionally separate from `README.md` and is ignored by git.

## Current State

- The repository started as an almost empty workspace with only a root README and the bundled phone export SQLite file.
- The public docs now define the intended v1 direction: single-owner personal finance web app, SQLite backend, import/reconciliation, analytics, and Telegram support.
- The public README covers end-user and repo-facing documentation. This file should stay focused on engineering context and non-obvious implementation notes.

## Decisions Already Made

- The app will be built as a full-stack Next.js TypeScript project.
- The live database stays local only, in an ignored runtime location such as `data/app.sqlite`.
- Uploaded source SQLite files stay local only in an ignored uploads directory.
- `codex.md` is local-only and must remain ignored by git.
- The phone export is a source-schema reference, not a runtime asset.
- The target model is normalized and centered on `account_groups`, `accounts`, `categories`, `transactions`, `import_batches`, and `import_candidates`.

## Schema Interpretation Notes

- `ASSETGROUP` maps to account grouping.
- `ASSETS` maps to accounts and account metadata.
- `ZCATEGORY` maps to the category tree.
- `INOUTCOME` maps to the transaction ledger.
- The source export also contains many app-specific tables that are not in scope for v1: budgets, tags, photos, SMS parsing, memo data, repeat transactions, code tables, and sync helpers.
- The export showed these core table sizes: `ASSETGROUP` 12 rows, `ASSETS` 19 rows, `ZCATEGORY` 82 rows, `INOUTCOME` 1904 rows.
- Source tables use a mix of integer, text, and real fields. The target schema should normalize dates and amounts rather than preserve source typing blindly.

## Invariants

- Preserve source `uid` values wherever they exist.
- Use a deterministic fingerprint as the fallback dedupe key.
- Never apply imports directly into main tables before diff review.
- Use soft deletes for imported rows so reconciliation remains auditable.
- Route Telegram writes through the same domain services as the web UI.
- Keep all secrets, tokens, allowed IDs, runtime DBs, and uploaded source DBs out of version control.

## Future Work

- Implement the SQLite schema and migrations.
- Build the phone SQLite parser and diff engine.
- Add import review UI and apply workflow.
- Add dashboard queries and chart modules.
- Add Telegram authorization and command handling.
- Add tests for dedupe, diffing, and import application.

## Repo Safety

- Do not commit local runtime files.
- Do not commit `.env.local` or any machine-specific secret file.
- Do not commit uploaded source databases.
- If a future fixture is ever needed, use a sanitized tracked sample with a different name and keep the runtime DB ignored.
