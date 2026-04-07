import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { diffBySourceUid, DiffSummary } from "./phone-sqlite/diff-engine";
import {
  mapLocalAccountGroups,
  mapLocalAccounts,
  mapLocalCategories,
} from "./phone-sqlite/local-snapshot";
import { normalizePhoneDatabaseSnapshot } from "./phone-sqlite/normalizers";
import { readPhoneDatabaseSnapshot } from "./phone-sqlite/parser";
import { parseStatementPdfFile } from "./statement-pdf/parser";
import {
  getLocalStatementSignature,
  getStatementBaseSourceUid,
  getTransferSourceUid,
  getTransferTargetUid,
  isStatementPdfSourceRaw,
} from "./statement-pdf/utils";
import { resolveProjectPath } from "../config/paths";
import { TransactionRow } from "../db/repositories/transactions-repository";
import { ImportCandidate, TransactionInput } from "../domain/models";
import { createAppContext } from "../server/app-context";

export interface ImportSourceFileInput {
  bytes: Buffer;
  fileName: string;
  sourceChannel: "telegram" | "web";
}

export interface ImportSourceFileResult {
  batchId: number;
  reused: boolean;
  counts?: Record<string, DiffSummary>;
  candidates: ImportCandidate[];
}

function sanitizeFilename(filename: string) {
  return basename(filename).replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function isPdfFile(input: ImportSourceFileInput) {
  return input.fileName.toLocaleLowerCase("en-US").endsWith(".pdf")
    || input.bytes.subarray(0, 4).toString("utf8") === "%PDF";
}

function buildSourceFileHash(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

function createEmptySummary(): DiffSummary {
  return {
    added: 0,
    changed: 0,
    missing: 0,
    unchanged: 0,
  };
}

function createSelectionSafeTransaction(
  input: TransactionInput,
): TransactionInput {
  return {
    ...input,
    accountSourceUid: null,
    targetAccountSourceUid: null,
    categorySourceUid: null,
  };
}

function createStatementLocalPayload(rows: TransactionRow[]): TransactionInput | undefined {
  if (rows.length === 0) {
    return undefined;
  }

  const sourceRow = rows.find((row) => row.source_uid.endsWith(":out")) ?? rows[0];
  const targetRow = rows.find((row) => row.source_uid.endsWith(":in"));
  const sourceRaw = sourceRow.source_raw_json ? JSON.parse(sourceRow.source_raw_json) : undefined;
  const statementSourceRaw = isStatementPdfSourceRaw(sourceRaw) ? sourceRaw : undefined;
  const isTransfer = rows.some((row) => row.source_uid.endsWith(":out") || row.source_uid.endsWith(":in"));

  return {
    sourceUid: getStatementBaseSourceUid(sourceRow.source_uid),
    sourceHash: sourceRow.source_hash,
    sourceDeleted: Boolean(sourceRow.source_deleted),
    sourceRaw: statementSourceRaw,
    accountSourceUid: sourceRow.source_account_uid,
    targetAccountSourceUid: isTransfer
      ? (sourceRow.source_target_account_uid ?? targetRow?.source_account_uid ?? null)
      : null,
    categorySourceUid: isTransfer ? null : sourceRow.source_category_uid,
    transactionType: isTransfer ? 3 : sourceRow.transaction_type,
    transactionDate: sourceRow.transaction_date,
    bookedAt: sourceRow.booked_at,
    paidAt: sourceRow.paid_at,
    amount: sourceRow.amount,
    amountAccount: sourceRow.amount_account,
    memo: sourceRow.memo,
    content: sourceRow.content,
    payee: sourceRow.payee,
    smsOrigin: sourceRow.sms_origin,
    isPaid: Boolean(sourceRow.is_paid),
    origin: sourceRow.origin,
  };
}

function createSemanticLocalPayload(row: TransactionRow): TransactionInput {
  const sourceRaw = row.source_raw_json ? JSON.parse(row.source_raw_json) : undefined;

  return {
    sourceUid: row.source_uid,
    sourceHash: row.source_hash,
    sourceDeleted: Boolean(row.source_deleted),
    sourceRaw,
    accountSourceUid: row.source_account_uid,
    targetAccountSourceUid: row.source_target_account_uid,
    categorySourceUid: row.source_category_uid,
    transactionType: row.transaction_type,
    transactionDate: row.transaction_date,
    bookedAt: row.booked_at,
    paidAt: row.paid_at,
    amount: row.amount,
    amountAccount: row.amount_account,
    memo: row.memo,
    content: row.content,
    payee: row.payee,
    smsOrigin: row.sms_origin,
    isPaid: Boolean(row.is_paid),
    origin: row.origin,
  };
}

function createStatementCandidates(
  localTransactions: TransactionRow[],
  incomingTransactions: TransactionInput[],
) {
  const exactLocalGroups = new Map<string, TransactionRow[]>();

  for (const row of localTransactions) {
    if (row.source_deleted !== 0 || row.origin !== "statement_pdf") {
      continue;
    }

    const sourceRaw = row.source_raw_json ? JSON.parse(row.source_raw_json) : undefined;
    if (!isStatementPdfSourceRaw(sourceRaw)) {
      continue;
    }

    const baseSourceUid = getStatementBaseSourceUid(row.source_uid);
    const existingRows = exactLocalGroups.get(baseSourceUid) ?? [];
    existingRows.push(row);
    exactLocalGroups.set(baseSourceUid, existingRows);
  }

  const semanticLocalGroups = new Map<string, TransactionRow[]>();

  for (const row of localTransactions) {
    if (row.source_deleted !== 0) {
      continue;
    }

    const statementGroup = exactLocalGroups.get(getStatementBaseSourceUid(row.source_uid));
    if (statementGroup && row.origin === "statement_pdf") {
      continue;
    }

    const signature = getLocalStatementSignature(row);
    if (!signature) {
      continue;
    }

    const existingRows = semanticLocalGroups.get(signature) ?? [];
    existingRows.push(row);
    semanticLocalGroups.set(signature, existingRows);
  }

  for (const rows of semanticLocalGroups.values()) {
    rows.sort((left, right) => left.id - right.id);
  }

  const semanticMatchIndexes = new Map<string, number>();
  const candidates: ImportCandidate[] = [];
  const summary = createEmptySummary();

  for (const incomingTransaction of incomingTransactions) {
    const sourceRaw = incomingTransaction.sourceRaw;
    if (!isStatementPdfSourceRaw(sourceRaw)) {
      continue;
    }

    const exactLocalRows = exactLocalGroups.get(incomingTransaction.sourceUid);
    if (exactLocalRows) {
      candidates.push({
        entityType: "transaction",
        entityKey: incomingTransaction.sourceUid,
        diffKind: "unchanged",
        action: "keep",
        local: createStatementLocalPayload(exactLocalRows),
        incoming: createSelectionSafeTransaction(incomingTransaction),
        diff: {
          matchType: "exact_statement",
          localSourceUids: exactLocalRows.map((row) => row.source_uid),
        },
      });
      summary.unchanged += 1;
      continue;
    }

    const signature = `${incomingTransaction.transactionDate}|${sourceRaw.normalizedOperation}|${sourceRaw.signedAmount.toFixed(2)}`;
    const localGroup = semanticLocalGroups.get(signature) ?? [];
    const semanticMatchIndex = semanticMatchIndexes.get(signature) ?? 0;
    const semanticLocalRow = localGroup[semanticMatchIndex];

    if (semanticLocalRow) {
      semanticMatchIndexes.set(signature, semanticMatchIndex + 1);
      candidates.push({
        entityType: "transaction",
        entityKey: incomingTransaction.sourceUid,
        diffKind: "unchanged",
        action: "keep",
        local: createSemanticLocalPayload(semanticLocalRow),
        incoming: createSelectionSafeTransaction(incomingTransaction),
        diff: {
          matchType: "semantic_duplicate",
          localSourceUids: [semanticLocalRow.source_uid],
        },
      });
      summary.unchanged += 1;
      continue;
    }

    candidates.push({
      entityType: "transaction",
      entityKey: incomingTransaction.sourceUid,
      diffKind: "new",
      action: "add",
      incoming: createSelectionSafeTransaction(incomingTransaction),
      diff: {
        matchType: "new",
      },
    });
    summary.added += 1;
  }

  return {
    candidates,
    summary,
  };
}

async function buildSqliteImportResult(
  context: Awaited<ReturnType<typeof createAppContext>>,
  storedFilePath: string,
) {
  const phoneSnapshot = await readPhoneDatabaseSnapshot(storedFilePath);
  const normalizedIncoming = normalizePhoneDatabaseSnapshot(phoneSnapshot);
  const [localAccountGroups, localAccounts, localCategories, localTransactions] = await Promise.all([
    context.repositories.accountGroups.list(),
    context.repositories.accounts.list(),
    context.repositories.categories.list(),
    context.repositories.transactions.list(),
  ]);

  const accountGroupDiff = diffBySourceUid(
    "account_group",
    mapLocalAccountGroups(localAccountGroups),
    normalizedIncoming.accountGroups,
  );
  const accountDiff = diffBySourceUid(
    "account",
    mapLocalAccounts(localAccounts),
    normalizedIncoming.accounts,
  );
  const categoryDiff = diffBySourceUid(
    "category",
    mapLocalCategories(localCategories),
    normalizedIncoming.categories,
  );
  const transactionDiff = diffBySourceUid(
    "transaction",
    localTransactions.map<TransactionInput>((row) => ({
      sourceUid: row.source_uid,
      sourceHash: row.source_hash,
      sourceDeleted: Boolean(row.source_deleted),
      sourceRaw: row.source_raw_json ? JSON.parse(row.source_raw_json) : undefined,
      accountSourceUid: row.source_account_uid,
      targetAccountSourceUid: row.source_target_account_uid,
      categorySourceUid: row.source_category_uid,
      transactionType: row.transaction_type,
      transactionDate: row.transaction_date,
      bookedAt: row.booked_at,
      paidAt: row.paid_at,
      amount: row.amount,
      amountAccount: row.amount_account,
      memo: row.memo,
      content: row.content,
      payee: row.payee,
      smsOrigin: row.sms_origin,
      isPaid: Boolean(row.is_paid),
      origin: row.origin,
    })),
    normalizedIncoming.transactions,
  );

  const candidates = [
    ...accountGroupDiff.candidates,
    ...accountDiff.candidates,
    ...categoryDiff.candidates,
    ...transactionDiff.candidates,
  ];

  return {
    candidates: candidates.filter((candidate) => candidate.diffKind !== "unchanged"),
    counts: {
      accountGroups: accountGroupDiff.summary,
      accounts: accountDiff.summary,
      categories: categoryDiff.summary,
      transactions: transactionDiff.summary,
    },
  };
}

async function buildPdfImportResult(
  context: Awaited<ReturnType<typeof createAppContext>>,
  storedFilePath: string,
) {
  const parsedStatement = await parseStatementPdfFile({
    allowedConti: context.env.bankStatementAllowedConti,
    filePath: storedFilePath,
  });
  const localTransactions = await context.repositories.transactions.list();
  const transactionDiff = createStatementCandidates(localTransactions, parsedStatement.transactions);

  return {
    candidates: transactionDiff.candidates,
    counts: {
      transactions: transactionDiff.summary,
    },
  };
}

export async function importSourceFile(
  context: Awaited<ReturnType<typeof createAppContext>>,
  input: ImportSourceFileInput,
): Promise<ImportSourceFileResult> {
  const fileHash = buildSourceFileHash(input.bytes);
  const existingBatch = await context.repositories.importBatches.getBySha256(fileHash);

  if (existingBatch) {
    const existingCandidates = await context.repositories.importCandidates.listByBatch(existingBatch.id);
    return {
      batchId: existingBatch.id,
      reused: true,
      candidates: existingCandidates.map((row) => ({
        entityType: row.entity_type as ImportCandidate["entityType"],
        entityKey: row.entity_key,
        diffKind: "unchanged",
        action: row.action as ImportCandidate["action"],
        local: row.local_payload_json ? JSON.parse(row.local_payload_json) : undefined,
        incoming: row.incoming_payload_json ? JSON.parse(row.incoming_payload_json) : undefined,
        diff: row.diff_payload_json ? JSON.parse(row.diff_payload_json) as Record<string, unknown> : undefined,
      })),
    };
  }

  const uploadsDir = resolveProjectPath(context.env.uploadsDir);
  await mkdir(uploadsDir, { recursive: true });

  const fallbackName = isPdfFile(input) ? "statement.pdf" : "phone-export.sqlite";
  const storedFilename = `${Date.now()}-${sanitizeFilename(input.fileName || fallbackName)}`;
  const storedFilePath = join(uploadsDir, storedFilename);
  await writeFile(storedFilePath, input.bytes);

  const builtImport = isPdfFile(input)
    ? await buildPdfImportResult(context, storedFilePath)
    : await buildSqliteImportResult(context, storedFilePath);

  const batchId = await context.repositories.importBatches.create({
    sourceFileName: input.fileName || storedFilename,
    sourceFilePath: storedFilePath,
    sourceFileSha256: fileHash,
    notes: `source:${input.sourceChannel}`,
  });

  await context.repositories.importCandidates.upsertMany(batchId, builtImport.candidates);

  return {
    batchId,
    reused: false,
    counts: builtImport.counts,
    candidates: builtImport.candidates,
  };
}

export function createStatementTransferSourceUid(baseSourceUid: string) {
  return getTransferSourceUid(baseSourceUid);
}

export function createStatementTransferTargetUid(baseSourceUid: string) {
  return getTransferTargetUid(baseSourceUid);
}
