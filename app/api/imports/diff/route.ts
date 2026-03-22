import { NextResponse } from "next/server";
import { ImportCandidateRow } from "@/lib/db/repositories/import-candidates-repository";
import { createAppContext } from "@/lib/server/app-context";

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

export async function GET(request: Request) {
  const context = await createAppContext();

  try {
    const { searchParams } = new URL(request.url);
    const batchId = Number(searchParams.get("batchId"));

    if (!Number.isFinite(batchId)) {
      return NextResponse.json({ error: "A numeric batchId query parameter is required." }, { status: 400 });
    }

    const candidates = await context.repositories.importCandidates.listByBatch(batchId);
    return NextResponse.json({ batchId, candidates: candidates.map(serializeStoredCandidate) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read import diff" },
      { status: 500 },
    );
  } finally {
    await context.client.close();
  }
}
