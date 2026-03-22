import { ImportAction, ImportCandidate, ImportDiffKind, SourceRecord } from "../../domain/models";

export interface DiffSummary {
  added: number;
  changed: number;
  missing: number;
  unchanged: number;
}

export function createDiffCandidate<T extends SourceRecord>(
  entityType: ImportCandidate["entityType"],
  localRecord: T | undefined,
  incomingRecord: T | undefined,
): ImportCandidate<T> {
  const diffKind: ImportDiffKind = !localRecord
    ? "new"
    : !incomingRecord
      ? "missing"
      : localRecord.sourceHash === incomingRecord.sourceHash
        ? "unchanged"
        : "changed";

  const action: ImportAction =
    diffKind === "new"
      ? "add"
      : diffKind === "changed"
        ? "update"
        : diffKind === "missing"
          ? "delete"
          : "keep";

  return {
    entityType,
    entityKey: incomingRecord?.sourceUid ?? localRecord?.sourceUid ?? "unknown",
    diffKind,
    action,
    local: localRecord,
    incoming: incomingRecord,
    diff:
      localRecord && incomingRecord
        ? { sourceHash: { local: localRecord.sourceHash, incoming: incomingRecord.sourceHash } }
        : undefined,
  };
}

export function diffBySourceUid<T extends SourceRecord>(
  entityType: ImportCandidate["entityType"],
  localRecords: T[],
  incomingRecords: T[],
): { candidates: ImportCandidate<T>[]; summary: DiffSummary } {
  const localMap = new Map(localRecords.map((record) => [record.sourceUid, record]));
  const incomingMap = new Map(incomingRecords.map((record) => [record.sourceUid, record]));
  const candidates: ImportCandidate<T>[] = [];

  for (const incomingRecord of incomingRecords) {
    const localRecord = localMap.get(incomingRecord.sourceUid);
    candidates.push(createDiffCandidate(entityType, localRecord, incomingRecord));
  }

  for (const localRecord of localRecords) {
    if (!incomingMap.has(localRecord.sourceUid)) {
      candidates.push(createDiffCandidate(entityType, localRecord, undefined));
    }
  }

  return {
    candidates,
    summary: candidates.reduce<DiffSummary>(
      (accumulator, candidate) => {
        if (candidate.diffKind === "new") {
          accumulator.added += 1;
        } else if (candidate.diffKind === "changed") {
          accumulator.changed += 1;
        } else if (candidate.diffKind === "missing") {
          accumulator.missing += 1;
        } else {
          accumulator.unchanged += 1;
        }

        return accumulator;
      },
      { added: 0, changed: 0, missing: 0, unchanged: 0 },
    ),
  };
}
