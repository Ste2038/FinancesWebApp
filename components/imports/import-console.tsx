"use client";

import { useMemo, useState, useTransition } from "react";

type ImportCandidate = {
  entityType: string;
  entityKey: string;
  action: "add" | "update" | "keep" | "delete" | "ignore";
  suggestedAction?: "add" | "update" | "keep" | "delete" | "ignore";
  diffKind?: string;
  local?: Record<string, unknown>;
  incoming?: Record<string, unknown>;
  diff?: Record<string, unknown>;
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

const ACTIONS: Array<ImportCandidate["action"]> = ["add", "update", "keep", "delete", "ignore"];

function readBestLabel(payload: Record<string, unknown> | undefined) {
  if (!payload) {
    return "No payload";
  }

  return (
    (typeof payload.displayName === "string" && payload.displayName) ||
    (typeof payload.memo === "string" && payload.memo) ||
    (typeof payload.content === "string" && payload.content) ||
    (typeof payload.sourceUid === "string" && payload.sourceUid) ||
    "Unnamed record"
  );
}

function describeCandidate(candidate: ImportCandidate) {
  const incomingLabel = readBestLabel(candidate.incoming);
  const localLabel = readBestLabel(candidate.local);

  if (candidate.entityType === "transaction") {
    return incomingLabel !== "No payload" ? incomingLabel : localLabel;
  }

  return incomingLabel !== "No payload" ? incomingLabel : localLabel;
}

function withSuggestedActions(candidates: ImportCandidate[]) {
  return candidates.map((candidate) => ({
    ...candidate,
    suggestedAction: candidate.suggestedAction ?? candidate.action,
  }));
}

export function ImportConsole({
  initialQueuedImports,
}: {
  initialQueuedImports: QueuedImport[];
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [batchId, setBatchId] = useState<number | null>(null);
  const [counts, setCounts] = useState<ParseResponse["counts"]>();
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [queuedImports, setQueuedImports] = useState<QueuedImport[]>(initialQueuedImports);
  const [feedback, setFeedback] = useState<string>("Upload a phone SQLite export to generate a reconciliation batch.");
  const [isPending, startTransition] = useTransition();

  const groupedCounts = useMemo(() => {
    if (!counts) {
      return [];
    }

    return Object.entries(counts);
  }, [counts]);

  function updateCandidateAction(entityKey: string, entityType: string, action: ImportCandidate["action"]) {
    setCandidates((current) =>
      current.map((candidate) =>
        candidate.entityKey === entityKey && candidate.entityType === entityType
          ? { ...candidate, action }
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
      setFeedback("Select a `.sqlite` file first.");
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
            ? `Batch ${parsed.batchId} is ready. Review ${parsed.candidates.length} actionable differences.`
            : `Batch ${parsed.batchId} has no actionable differences.`,
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
            ? `Opened queued batch ${payload.batchId} with ${payload.candidates.length} actionable differences.`
            : `Queued batch ${payload.batchId} has no actionable differences left.`,
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
            <h2>Import a phone SQLite</h2>
            <p>The uploaded file stays in a local git-ignored folder. Only actionable differences are returned for review.</p>
          </div>
        </div>

        <div className="import-dropzone">
          <div className="import-console__controls">
            <input
              accept=".sqlite,.db,.sqlite3"
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
              <p>Counts include unchanged rows even though only actionable differences are shown below.</p>
            </div>
          </div>

          <div className="import-summary-grid">
            {groupedCounts.map(([entityType, summary]) => (
              <article className="summary-card" key={entityType}>
                <span className="summary-card__label">{entityType.replace("_", " ")}</span>
                <strong>{summary.added + summary.changed + summary.missing}</strong>
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
              <p>Each candidate is explicit. You can change the default action before applying the batch.</p>
            </div>
          </div>

          <div className="import-candidate-list">
            {candidates.map((candidate) => (
              <article className="import-candidate-card" key={`${candidate.entityType}:${candidate.entityKey}`}>
                <div>
                  <span className="metric-tag">{candidate.entityType.replace("_", " ")}</span>
                  <h3>{describeCandidate(candidate)}</h3>
                  <p className="muted">
                    {candidate.entityKey}
                    {candidate.diffKind ? ` · ${candidate.diffKind}` : ""}
                  </p>
                </div>

                <div className="import-candidate-card__side">
                  <select
                    className="select-input"
                    onChange={(event) =>
                      updateCandidateAction(
                        candidate.entityKey,
                        candidate.entityType,
                        event.target.value as ImportCandidate["action"],
                      )
                    }
                    value={candidate.action}
                  >
                    {ACTIONS.map((action) => (
                      <option key={action} value={action}>
                        {action}
                      </option>
                    ))}
                  </select>
                  <div className="import-candidate-card__payload">
                    <span>Incoming: {readBestLabel(candidate.incoming)}</span>
                    <span>Local: {readBestLabel(candidate.local)}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
