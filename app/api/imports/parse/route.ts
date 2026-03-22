import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { NextResponse } from "next/server";
import { diffBySourceUid } from "@/lib/importers/phone-sqlite/diff-engine";
import {
  mapLocalAccountGroups,
  mapLocalAccounts,
  mapLocalCategories,
  mapLocalTransactions,
} from "@/lib/importers/phone-sqlite/local-snapshot";
import { normalizePhoneDatabaseSnapshot } from "@/lib/importers/phone-sqlite/normalizers";
import { readPhoneDatabaseSnapshot } from "@/lib/importers/phone-sqlite/parser";
import { createAppContext } from "@/lib/server/app-context";
import { resolveProjectPath } from "@/lib/config/paths";
import { ImportCandidateRow } from "@/lib/db/repositories/import-candidates-repository";

type UploadedFileLike = Exclude<FormDataEntryValue, string> & {
  name?: string;
};

function sanitizeFilename(filename: string) {
  return basename(filename).replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function isUploadedFile(value: FormDataEntryValue | null): value is UploadedFileLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    typeof value.arrayBuffer === "function"
  );
}

function serializeStoredCandidate(row: ImportCandidateRow) {
  return {
    entityType: row.entity_type,
    entityKey: row.entity_key,
    action: row.action,
    local: row.local_payload_json ? JSON.parse(row.local_payload_json) : undefined,
    incoming: row.incoming_payload_json ? JSON.parse(row.incoming_payload_json) : undefined,
    diff: row.diff_payload_json ? JSON.parse(row.diff_payload_json) : undefined,
  };
}

export async function POST(request: Request) {
  const context = await createAppContext();

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!isUploadedFile(file)) {
      return NextResponse.json({ error: "Expected a SQLite file upload in `file`." }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const fileHash = createHash("sha256").update(bytes).digest("hex");
    const existingBatch = await context.repositories.importBatches.getBySha256(fileHash);

    if (existingBatch) {
      const existingCandidates = await context.repositories.importCandidates.listByBatch(existingBatch.id);
      return NextResponse.json({
        batchId: existingBatch.id,
        reused: true,
        candidates: existingCandidates.map(serializeStoredCandidate),
      });
    }

    const uploadsDir = resolveProjectPath(context.env.uploadsDir);
    await mkdir(uploadsDir, { recursive: true });

    const storedFilename = `${Date.now()}-${sanitizeFilename(file.name || "phone-export.sqlite")}`;
    const storedFilePath = join(uploadsDir, storedFilename);
    await writeFile(storedFilePath, bytes);

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
    const accountDiff = diffBySourceUid("account", mapLocalAccounts(localAccounts), normalizedIncoming.accounts);
    const categoryDiff = diffBySourceUid("category", mapLocalCategories(localCategories), normalizedIncoming.categories);
    const transactionDiff = diffBySourceUid(
      "transaction",
      mapLocalTransactions(localTransactions),
      normalizedIncoming.transactions,
    );

    const candidates = [
      ...accountGroupDiff.candidates,
      ...accountDiff.candidates,
      ...categoryDiff.candidates,
      ...transactionDiff.candidates,
    ];
    const actionableCandidates = candidates.filter((candidate) => candidate.diffKind !== "unchanged");

    const batchId = await context.repositories.importBatches.create({
      sourceFileName: file.name || storedFilename,
      sourceFilePath: storedFilePath,
      sourceFileSha256: fileHash,
    });

    await context.repositories.importCandidates.upsertMany(batchId, actionableCandidates);

    return NextResponse.json({
      batchId,
      reused: false,
      counts: {
        accountGroups: accountGroupDiff.summary,
        accounts: accountDiff.summary,
        categories: categoryDiff.summary,
        transactions: transactionDiff.summary,
      },
      candidates: actionableCandidates,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to parse import" },
      { status: 500 },
    );
  } finally {
    await context.client.close();
  }
}
