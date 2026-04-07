"use client";

import { useMemo, useState, useTransition } from "react";
import { formatSignedEuroCurrency } from "@/lib/format/currency";

type ImportAction = "add" | "update" | "keep" | "delete" | "ignore";

type TransactionReview = {
  accountSourceUid: string | null;
  categorySourceUid: string | null;
  isTransfer: boolean;
  targetAccountSourceUid: string | null;
};

type ImportCandidate = {
  entityType: string;
  entityKey: string;
  action: ImportAction;
  suggestedAction?: ImportAction;
  diffKind?: string;
  local?: Record<string, unknown>;
  incoming?: Record<string, unknown>;
  diff?: Record<string, unknown>;
  allowedActions?: ImportAction[];
  transactionReview?: TransactionReview;
  statementDetails?: {
    conto: string;
    operation: string;
    bankCategory: string | null;
    bookedFlag: string | null;
    signedAmount: number;
    transactionDate: string | null;
  };
};

type ParseResponse = {
  batchId: number;
  reused: boolean;
  counts?: Record<string, { added: number; changed: number; missing: number; unchanged: number }>;
  candidates: ImportCandidate[];
};

type QueuedImport = {
  id: number;
  source_file_name: string;
  status: string;
  imported_at: string | null;
  created_at?: string;
  total_candidates?: number;
  pending_candidates?: number;
};

type Option = {
  label: string;
  value: string;
};

const ALL_ACTIONS: ImportAction[] = ["add", "update", "keep", "delete", "ignore"];

function readBestLabel(payload: Record<string, unknown> | undefined) {
  if (!payload) {
    return "No payload";
  }

  return (
    (typeof payload.displayName === "string" && payload.displayName)
    || (typeof payload.memo === "string" && payload.memo)
    || (typeof payload.content === "string" && payload.content)
    || (typeof payload.sourceUid === "string" && payload.sourceUid)
    || "Unnamed record"
  );
}

function describeCandidate(candidate: ImportCandidate) {
  if (candidate.statementDetails?.operation) {
    return candidate.statementDetails.operation;
  }

  const incomingLabel = readBestLabel(candidate.incoming);
  const localLabel = readBestLabel(candidate.local);
  return incomingLabel !== "No payload" ? incomingLabel : localLabel;
}

function withSuggestedActions(candidates: ImportCandidate[]) {
  return candidates.map((candidate) => ({
    ...candidate,
    suggestedAction: candidate.suggestedAction ?? candidate.action,
  }));
}

function formatStatementDate(value: string | null | undefined) {
  if (!value) {
    return "Unknown date";
  }

  const parts = value.split("-");
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }

  return value;
}

function createTransactionReviewPatch(
  current: TransactionReview | undefined,
  patch: Partial<TransactionReview>,
): TransactionReview {
  const nextReview: TransactionReview = {
    accountSourceUid: current?.accountSourceUid ?? null,
    categorySourceUid: current?.categorySourceUid ?? null,
    isTransfer: current?.isTransfer ?? false,
    targetAccountSourceUid: current?.targetAccountSourceUid ?? null,
    ...patch,
  };

  if (nextReview.isTransfer) {
    nextReview.categorySourceUid = null;
  } else {
    nextReview.targetAccountSourceUid = null;
  }

  return nextReview;
}

export function ImportConsole({
  accountOptions,
  categoryOptions,
  initialQueuedImports,
}: {
  accountOptions: Option[];
  categoryOptions: Option[];
  initialQueuedImports: QueuedImport[];
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [batchId, setBatchId] = useState<number | null>(null);
  const [counts, setCounts] = useState<ParseResponse["counts"]>();
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [queuedImports, setQueuedImports] = useState<QueuedImport[]>(initialQueuedImports);
  const [feedback, setFeedback] = useState<string>(
    "Upload a phone SQLite export or bank statement PDF to generate a reconciliation batch.",
  );
  const [isPending, startTransition] = useTransition();

  const groupedCounts = useMemo(() => {
    if (!counts) {
      return [];
    }

    return Object.entries(counts);
  }, [counts]);

  function updateCandidateAction(entityKey: string, entityType: string, action: ImportAction) {
    setCandidates((current) =>
      current.map((candidate) =>
        candidate.entityKey === entityKey && candidate.entityType === entityType
          ? { ...candidate, action }
          : candidate,
      ),
    );
  }

  function updateCandidateTransactionReview(
    entityKey: string,
    entityType: string,
    patch: Partial<TransactionReview>,
  ) {
    setCandidates((current) =>
      current.map((candidate) =>
        candidate.entityKey === entityKey && candidate.entityType === entityType
          ? {
              ...candidate,
              transactionReview: createTransactionReviewPatch(candidate.transactionReview, patch),
            }
          : candidate,
      ),
    );
  }

  async function refreshQueue() {
    const response = await fetch("/api/imports/queue", {
      method: "GET",
      cache: "no-store",
    });
    const payload = (await response.json()) as { batches?: QueuedImport[]; error?: string };

    if (!response.ok || !payload.batches) {
      throw new Error(payload.error ?? "Failed to refresh import queue");
    }

    setQueuedImports(payload.batches);
  }

  function handleUpload() {
    if (!selectedFile) {
      setFeedback("Select a `.sqlite` or `.pdf` file first.");
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("file", selectedFile);

        const response = await fetch("/api/imports/parse", {
          method: "POST",
          body: formData,
        });
        const payload = (await response.json()) as ParseResponse | { error?: string };

        if (!response.ok) {
          throw new Error("error" in payload ? payload.error : "Import parse failed");
        }

        const parsed = payload as ParseResponse;
        setBatchId(parsed.batchId);
        setCounts(parsed.counts);
        setCandidates(withSuggestedActions(parsed.candidates));
        await refreshQueue();
        setFeedback(
          parsed.candidates.length > 0
            ? `Batch ${parsed.batchId} is ready. Review ${parsed.candidates.length} candidates.`
            : `Batch ${parsed.batchId} has no review candidates.`,
        );
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Import parse failed");
      }
    });
  }

  function handleApply() {
    void submitSelections(candidates, "Applied selected actions");
  }

  function handleApplySuggested() {
    void submitSelections(
      candidates.map((candidate) => ({
        ...candidate,
        action: candidate.suggestedAction ?? candidate.action,
      })),
      "Applied all suggested changes",
    );
  }

  async function submitSelections(nextCandidates: ImportCandidate[], successPrefix: string) {
    if (!batchId) {
      setFeedback("Create an import batch before applying selections.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/imports/apply", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            batchId,
            selections: nextCandidates.map((candidate) => ({
              entityType: candidate.entityType,
              entityKey: candidate.entityKey,
              action: candidate.action,
              transactionReview: candidate.transactionReview,
            })),
          }),
        });
        const payload = (await response.json()) as
          | { batchId: number; summary: { created: number; updated: number; deleted: number; kept: number; ignored: number } }
          | { error?: string };

        if (!response.ok) {
          throw new Error("error" in payload ? payload.error : "Failed to apply import");
        }

        if ("summary" in payload) {
          await refreshQueue();
          setFeedback(
            `${successPrefix} for batch ${payload.batchId}: ${payload.summary.created} created, ${payload.summary.updated} updated, ${payload.summary.deleted} deleted, ${payload.summary.kept} kept, ${payload.summary.ignored} ignored.`,
          );
        }
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Failed to apply import");
      }
    });
  }

  function handleOpenBatch(nextBatchId: number) {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/imports/diff?batchId=${nextBatchId}`, {
          method: "GET",
          cache: "no-store",
        });
        const payload = (await response.json()) as
          | { batchId: number; candidates: ImportCandidate[]; error?: string }
          | { error?: string };

        if (!response.ok || !("batchId" in payload)) {
          throw new Error("error" in payload ? payload.error : "Failed to open queued import");
        }

        setBatchId(payload.batchId);
        setCounts(undefined);
        setCandidates(withSuggestedActions(payload.candidates));
        setFeedback(
          payload.candidates.length > 0
            ? `Opened queued batch ${payload.batchId} with ${payload.candidates.length} candidates.`
            : `Queued batch ${payload.batchId} has no review candidates left.`,
        );
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Failed to open queued import");
      }
    });
  }

  return (
    <div className="import-console">
      {queuedImports.length > 0 ? (
        <div className="section-card">
          <div className="section-card__header">
            <div>
              <h2>Queued imports</h2>
              <p>These batches already exist in the local database. Open one to continue review or apply it.</p>
            </div>
          </div>

          <div className="queued-imports-list">
            {queuedImports.map((queuedImport) => (
              <article
                className={`queued-import-card${batchId === queuedImport.id ? " queued-import-card--active" : ""}`}
                key={queuedImport.id}
              >
                <div>
                  <span className="metric-tag">Batch {queuedImport.id}</span>
                  <h3>{queuedImport.source_file_name}</h3>
                  <p className="muted">
                    Status: {queuedImport.status}
                    {queuedImport.created_at ? ` · queued ${queuedImport.created_at}` : ""}
                    {queuedImport.imported_at ? ` · imported ${queuedImport.imported_at}` : ""}
                  </p>
                </div>

                <div className="queued-import-card__side">
                  <div className="queued-import-card__metrics">
                    <span className="badge">{queuedImport.total_candidates ?? 0} total</span>
                    <span className={`badge${(queuedImport.pending_candidates ?? 0) > 0 ? " badge--warning" : " badge--good"}`}>
                      {queuedImport.pending_candidates ?? 0} pending
                    </span>
                  </div>
                  <button
                    className="form-button form-button--secondary"
                    disabled={isPending}
                    onClick={() => handleOpenBatch(queuedImport.id)}
                    type="button"
                  >
                    Open batch
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      <div className="section-card">
        <div className="section-card__header">
          <div>
            <h2>Import a source file</h2>
            <p>The uploaded file stays in a local git-ignored folder. SQLite exports and bank statement PDFs use the same batch review flow.</p>
          </div>
        </div>

        <div className="import-dropzone">
          <div className="import-console__controls">
            <input
              accept=".sqlite,.db,.sqlite3,.pdf,application/pdf"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              type="file"
            />
            <div className="import-console__actions">
              <button className="form-button" disabled={isPending || !selectedFile} onClick={handleUpload} type="button">
                {isPending ? "Processing..." : "Parse import"}
              </button>
              <button
                className="form-button form-button--secondary"
                disabled={isPending || !batchId || candidates.length === 0}
                onClick={handleApplySuggested}
                type="button"
              >
                Apply all suggested changes
              </button>
              <button
                className="form-button form-button--secondary"
                disabled={isPending || !batchId || candidates.length === 0}
                onClick={handleApply}
                type="button"
              >
                Apply selected actions
              </button>
            </div>
            <p className="muted">{feedback}</p>
          </div>
        </div>
      </div>

      {groupedCounts.length > 0 ? (
        <div className="section-card">
          <div className="section-card__header">
            <div>
              <h2>Diff summary</h2>
              <p>Matched duplicates are counted under unchanged rows. Statement PDF batches show transaction counts only.</p>
            </div>
          </div>

          <div className="import-summary-grid">
            {groupedCounts.map(([entityType, summary]) => (
              <article className="summary-card" key={entityType}>
                <span className="summary-card__label">{entityType.replace("_", " ")}</span>
                <strong>{summary.added + summary.changed + summary.missing + summary.unchanged}</strong>
                <p>
                  {summary.added} new, {summary.changed} changed, {summary.missing} missing, {summary.unchanged} unchanged
                </p>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {candidates.length > 0 ? (
        <div className="section-card">
          <div className="section-card__header">
            <div>
              <h2>Review candidates</h2>
              <p>Each candidate is explicit. Statement PDF rows let you choose the account, category, and transfer behavior before apply.</p>
            </div>
          </div>

          <div className="import-candidate-list">
            {candidates.map((candidate) => {
              const allowedActions = candidate.allowedActions ?? ALL_ACTIONS;
              const review = candidate.transactionReview;

              return (
                <article className="import-candidate-card" key={`${candidate.entityType}:${candidate.entityKey}`}>
                  <div className="import-candidate-card__main">
                    <div>
                      <span className="metric-tag">{candidate.entityType.replace("_", " ")}</span>
                      <h3>{describeCandidate(candidate)}</h3>
                      <p className="muted">
                        {candidate.entityKey}
                        {candidate.diffKind ? ` · ${candidate.diffKind}` : ""}
                      </p>
                    </div>

                    {candidate.statementDetails ? (
                      <div className="statement-details">
                        <span><strong>Conto:</strong> {candidate.statementDetails.conto}</span>
                        <span><strong>Data:</strong> {formatStatementDate(candidate.statementDetails.transactionDate)}</span>
                        <span><strong>Importo:</strong> {formatSignedEuroCurrency(candidate.statementDetails.signedAmount)}</span>
                        <span><strong>Contabilizzato:</strong> {candidate.statementDetails.bookedFlag ?? "N/A"}</span>
                        <span><strong>Categoria banca:</strong> {candidate.statementDetails.bankCategory ?? "N/A"}</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="import-candidate-card__side">
                    <select
                      className="select-input"
                      onChange={(event) =>
                        updateCandidateAction(
                          candidate.entityKey,
                          candidate.entityType,
                          event.target.value as ImportAction,
                        )
                      }
                      value={candidate.action}
                    >
                      {allowedActions.map((action) => (
                        <option key={action} value={action}>
                          {action}
                        </option>
                      ))}
                    </select>

                    {candidate.statementDetails && review ? (
                      <div className="statement-review">
                        <label className="statement-review__field">
                          <span>Account</span>
                          <select
                            className="select-input"
                            onChange={(event) =>
                              updateCandidateTransactionReview(candidate.entityKey, candidate.entityType, {
                                accountSourceUid: event.target.value || null,
                              })
                            }
                            value={review.accountSourceUid ?? ""}
                          >
                            <option value="">Select account</option>
                            {accountOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="statement-review__checkbox">
                          <input
                            checked={review.isTransfer}
                            onChange={(event) =>
                              updateCandidateTransactionReview(candidate.entityKey, candidate.entityType, {
                                isTransfer: event.target.checked,
                              })
                            }
                            type="checkbox"
                          />
                          <span>Mark as transfer</span>
                        </label>

                        {review.isTransfer ? (
                          <label className="statement-review__field">
                            <span>Target account</span>
                            <select
                              className="select-input"
                              onChange={(event) =>
                                updateCandidateTransactionReview(candidate.entityKey, candidate.entityType, {
                                  targetAccountSourceUid: event.target.value || null,
                                })
                              }
                              value={review.targetAccountSourceUid ?? ""}
                            >
                              <option value="">Select target account</option>
                              {accountOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : (
                          <label className="statement-review__field">
                            <span>Category</span>
                            <select
                              className="select-input"
                              onChange={(event) =>
                                updateCandidateTransactionReview(candidate.entityKey, candidate.entityType, {
                                  categorySourceUid: event.target.value || null,
                                })
                              }
                              value={review.categorySourceUid ?? ""}
                            >
                              <option value="">Select category</option>
                              {categoryOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                      </div>
                    ) : null}

                    <div className="import-candidate-card__payload">
                      <span>Incoming: {readBestLabel(candidate.incoming)}</span>
                      <span>Local: {readBestLabel(candidate.local)}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
