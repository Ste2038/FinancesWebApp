import { SectionCard } from "@/components/dashboard/section-card";
import { getCategoriesList } from "@/lib/server/finance-data";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await getCategoriesList();

  return (
    <>
      <section className="hero">
        <div className="hero__copy">
          <span className="topbar__eyebrow">Categories</span>
          <h2>The category tree stays hierarchical, but the ledger remains normalized.</h2>
          <p>
            The source app stores categories in `ZCATEGORY`. The internal model preserves parent-child
            relationships and type while dropping mobile-app-specific noise.
          </p>
        </div>
      </section>

      <div className="table-grid">
        <section className="table-card">
          <h2>Category registry</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {categories.length > 0 ? (
                categories.map((category) => (
                  <tr key={category.source_uid}>
                    <td>{category.display_name}</td>
                    <td>{category.category_type === 0 ? "Income" : "Expense"}</td>
                    <td>{category.deleted_at ? "Archived" : "Active"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="muted">
                    No categories available yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <SectionCard
          description="The analytics layer will query local categories only, never the raw source tables."
          title="Expected behaviors"
        >
          <div className="category-list">
            <div className="category-row">
              <span>Hierarchy</span>
              <strong>Parent-child support</strong>
            </div>
            <div className="category-row">
              <span>Typing</span>
              <strong>Income or expense</strong>
            </div>
            <div className="category-row">
              <span>Import policy</span>
              <strong>Manual review for updates or deletions</strong>
            </div>
          </div>
        </SectionCard>
      </div>
    </>
  );
}
