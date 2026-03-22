import { ImportConsole } from "@/components/imports/import-console";
import { getImportQueue } from "@/lib/server/finance-data";

export const dynamic = "force-dynamic";

export default async function ImportsPage() {
  const queuedImports = await getImportQueue();

  return (
    <>
      <section className="hero">
        <div className="hero__copy">
          <span className="topbar__eyebrow">Imports</span>
          <h2>Upload the phone SQLite, inspect the diff, then apply exactly what you approve.</h2>
          <p>
            The import subsystem parses only the supported source tables, stores staging candidates, and
            keeps the live ledger untouched until the selected actions are applied in one transaction.
          </p>
        </div>
      </section>

      <div className="steps-grid">
        <article className="step-card">
          <strong>1</strong>
          <h3>Upload source DB</h3>
          <p>Select the latest phone export. The file is stored only in a local git-ignored directory.</p>
        </article>
        <article className="step-card">
          <strong>2</strong>
          <h3>Review differences</h3>
          <p>See proposed adds, updates, local-only rows, and delete candidates before anything changes.</p>
        </article>
        <article className="step-card">
          <strong>3</strong>
          <h3>Apply selected actions</h3>
          <p>The app writes through an import batch and preserves source linkage for later uploads.</p>
        </article>
      </div>

      <ImportConsole initialQueuedImports={queuedImports} />
    </>
  );
}
