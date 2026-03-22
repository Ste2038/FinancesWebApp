import { SectionCard } from "@/components/dashboard/section-card";

export default function SettingsPage() {
  return (
    <>
      <section className="hero">
        <div className="hero__copy">
          <span className="topbar__eyebrow">Settings</span>
          <h2>Public repository, private runtime.</h2>
          <p>
            Secrets, allowed Telegram IDs, uploaded SQLite files, and the live database all stay outside
            tracked source files. The app reads them from git-ignored local configuration.
          </p>
        </div>
      </section>

      <div className="card-grid">
        <SectionCard title="Local configuration" description="Committed code, private runtime state.">
          <div className="settings-list">
            <div className="settings-row">
              <span>Database path</span>
              <strong>from `.env.local`</strong>
            </div>
            <div className="settings-row">
              <span>Uploads directory</span>
              <strong>git-ignored local folder</strong>
            </div>
            <div className="settings-row">
              <span>Telegram token</span>
              <strong>local-only secret</strong>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Telegram scope" description="First release supports only the essential bot workflow.">
          <div className="metric-list">
            <div className="metric-row">
              <span>Add expense</span>
              <strong>Guided command flow</strong>
            </div>
            <div className="metric-row">
              <span>Show summary</span>
              <strong>Current balance snapshot</strong>
            </div>
            <div className="metric-row">
              <span>Access control</span>
              <strong>Allowed IDs only</strong>
            </div>
          </div>
        </SectionCard>
      </div>
    </>
  );
}
