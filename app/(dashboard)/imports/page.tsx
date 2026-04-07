import { ImportConsole } from "@/components/imports/import-console";
import { getAccountsList, getCategoriesList, getImportQueue } from "@/lib/server/finance-data";

export const dynamic = "force-dynamic";

export default async function ImportsPage() {
  const [queuedImports, accounts, categories] = await Promise.all([
    getImportQueue(),
    getAccountsList(),
    getCategoriesList(),
  ]);

  return (
    <>
      <section className="hero">
        <div className="hero__copy">
          <span className="topbar__eyebrow">Imports</span>
          <h2>Upload a phone SQLite export or a bank statement PDF, inspect the diff, then apply exactly what you approve.</h2>
          <p>
            The import subsystem stores review candidates first, keeps the live ledger untouched until
            apply, and now accepts both the phone database export and the supported bank statement PDF layout.
          </p>
        </div>
      </section>

      <div className="steps-grid">
        <article className="step-card">
          <strong>1</strong>
          <h3>Upload source file</h3>
          <p>Select the latest phone export or a supported bank statement PDF. The file stays in a local git-ignored directory.</p>
        </article>
        <article className="step-card">
          <strong>2</strong>
          <h3>Review differences</h3>
          <p>See proposed adds, matches, local-only rows, and any required account or category assignments before anything changes.</p>
        </article>
        <article className="step-card">
          <strong>3</strong>
          <h3>Apply selected actions</h3>
          <p>The app writes through an import batch, preserves source linkage, and can expand statement rows into transfer legs when needed.</p>
        </article>
      </div>

      <ImportConsole
        accountOptions={accounts
          .filter((account) => account.source_deleted === 0 && account.is_archived === 0)
          .map((account) => ({
            label: account.display_name,
            value: account.source_uid,
          }))}
        categoryOptions={categories
          .filter((category) => category.source_deleted === 0)
          .map((category) => ({
            label: category.display_name,
            value: category.source_uid,
          }))}
        initialQueuedImports={queuedImports}
      />
    </>
  );
}
