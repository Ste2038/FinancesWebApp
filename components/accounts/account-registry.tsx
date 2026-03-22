"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AccountListItem } from "@/lib/server/finance-data";

interface AccountRegistryProps {
  accounts: AccountListItem[];
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function AccountRegistry({ accounts }: AccountRegistryProps) {
  const router = useRouter();
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.source_deleted === 0 && account.is_archived === 0),
    [accounts],
  );
  const archivedAccounts = useMemo(
    () => accounts.filter((account) => account.source_deleted === 0 && account.is_archived === 1),
    [accounts],
  );
  const visibleAccounts = useMemo(
    () => (showArchived ? accounts : activeAccounts),
    [accounts, activeAccounts, showArchived],
  );
  const selectableAccounts = useMemo(
    () => visibleAccounts.filter((account) => account.source_deleted === 0),
    [visibleAccounts],
  );
  const selectableIds = useMemo(
    () => new Set(selectableAccounts.map((account) => account.source_uid)),
    [selectableAccounts],
  );
  const activeIds = useMemo(
    () => new Set(activeAccounts.map((account) => account.source_uid)),
    [activeAccounts],
  );
  const archivedIds = useMemo(
    () => new Set(archivedAccounts.map((account) => account.source_uid)),
    [archivedAccounts],
  );
  const visibleSelectedCount = selectedIds.filter((sourceUid) => selectableIds.has(sourceUid)).length;
  const activeSelectedCount = selectedIds.filter((sourceUid) => activeIds.has(sourceUid)).length;
  const archivedSelectedCount = selectedIds.filter((sourceUid) => archivedIds.has(sourceUid)).length;
  const allVisibleSelected = selectableAccounts.length > 0 && visibleSelectedCount === selectableAccounts.length;
  const someVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected;

  useEffect(() => {
    setSelectedIds((current) => current.filter((sourceUid) => selectableIds.has(sourceUid)));
  }, [selectableIds]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

  function toggleSelected(sourceUid: string) {
    setSelectedIds((current) =>
      current.includes(sourceUid)
        ? current.filter((value) => value !== sourceUid)
        : [...current, sourceUid],
    );
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds(selectableAccounts.map((account) => account.source_uid));
  }

  function updateSelectedAccounts(action: "archive" | "restore") {
    startTransition(() => {
      void (async () => {
        try {
          setError(null);
          setFeedback(null);

          const sourceUids =
            action === "restore"
              ? selectedIds.filter((sourceUid) => archivedIds.has(sourceUid))
              : selectedIds.filter((sourceUid) => activeIds.has(sourceUid));

          if (sourceUids.length === 0) {
            setError(
              action === "restore"
                ? "Select at least one archived account to restore."
                : "Select at least one active account to archive.",
            );
            return;
          }

          const response = await fetch("/api/accounts/archive", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ sourceUids, action }),
          });

          const payload = (await response.json().catch(() => null)) as
            | { changedCount?: number; error?: string }
            | null;

          if (!response.ok) {
            setError(payload?.error ?? `Failed to ${action} the selected accounts.`);
            return;
          }

          const changedCount = payload?.changedCount ?? sourceUids.length;
          setSelectedIds([]);
          setFeedback(
            action === "restore"
              ? changedCount === 1
                ? "1 account restored. It is included in balances and charts again."
                : `${changedCount} accounts restored. They are included in balances and charts again.`
              : changedCount === 1
                ? "1 account archived. Dashboard totals and charts now ignore it."
                : `${changedCount} accounts archived. Dashboard totals and charts now ignore them.`,
          );
          router.refresh();
        } catch (requestError) {
          setError(requestError instanceof Error ? requestError.message : `Failed to ${action} the selected accounts.`);
        }
      })();
    });
  }

  return (
    <section className="table-card">
      <div className="table-card__header">
        <div className="table-card__copy">
          <h2>Account registry</h2>
          <p>Archived accounts are excluded from portfolio totals and charts. Enable the toggle to review or restore them.</p>
        </div>
        <div className="table-card__actions">
          <label className="toggle-field">
            <input
              checked={showArchived}
              className="table-checkbox"
              onChange={(event) => setShowArchived(event.target.checked)}
              type="checkbox"
            />
            <span>Show archived accounts</span>
          </label>
          <button
            className="form-button form-button--secondary"
            disabled={isPending || selectableAccounts.length === 0}
            onClick={toggleAllVisible}
            type="button"
          >
            {allVisibleSelected ? "Clear selection" : "Select all shown"}
          </button>
          {showArchived ? (
            <button
              className="form-button form-button--secondary"
              disabled={isPending || archivedSelectedCount === 0}
              onClick={() => updateSelectedAccounts("restore")}
              type="button"
            >
              Restore selected accounts
            </button>
          ) : null}
          <button
            className="form-button"
            disabled={isPending || activeSelectedCount === 0}
            onClick={() => updateSelectedAccounts("archive")}
            type="button"
          >
            Archive selected accounts
          </button>
        </div>
      </div>

      {feedback ? <p className="form-feedback">{feedback}</p> : null}
      {error ? <p className="form-feedback form-feedback--error">{error}</p> : null}

      <table>
        <thead>
          <tr>
            <th>
              <input
                aria-label="Select all shown accounts"
                checked={allVisibleSelected}
                className="table-checkbox"
                disabled={selectableAccounts.length === 0 || isPending}
                onChange={toggleAllVisible}
                ref={selectAllRef}
                type="checkbox"
              />
            </th>
            <th>Name</th>
            <th>Group</th>
            <th>Balance</th>
            {showArchived ? <th>Status</th> : null}
          </tr>
        </thead>
        <tbody>
          {visibleAccounts.length > 0 ? (
            visibleAccounts.map((account) => {
              const isArchived = account.source_deleted === 1 || account.is_archived === 1;
              const statusLabel =
                account.source_deleted === 1 ? "Deleted in import" : account.is_archived === 1 ? "Archived" : "Active";

              return (
                <tr className={isArchived ? "table-row--archived" : undefined} key={account.source_uid}>
                  <td>
                    <input
                      aria-label={`Select ${account.display_name}`}
                      checked={selectedIds.includes(account.source_uid)}
                      className="table-checkbox"
                      disabled={account.source_deleted === 1 || isPending}
                      onChange={() => toggleSelected(account.source_uid)}
                      type="checkbox"
                    />
                  </td>
                  <td>{account.display_name}</td>
                  <td>{account.group_name ?? "Ungrouped"}</td>
                  <td>{formatCurrency(account.balance)}</td>
                  {showArchived ? (
                    <td>
                      <span className={`badge${isArchived ? " badge--warning" : " badge--good"}`}>{statusLabel}</span>
                    </td>
                  ) : null}
                </tr>
              );
            })
          ) : (
            <tr>
              <td className="muted" colSpan={showArchived ? 5 : 4}>
                {showArchived ? "No accounts available yet." : "No active accounts available yet."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
