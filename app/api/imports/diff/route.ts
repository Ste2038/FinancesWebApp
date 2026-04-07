import { NextResponse } from "next/server";
import { serializeStoredImportCandidate } from "@/lib/importers/import-candidate-serializer";
import { createAppContext } from "@/lib/server/app-context";

export async function GET(request: Request) {
  const context = await createAppContext();

  try {
    const { searchParams } = new URL(request.url);
    const batchId = Number(searchParams.get("batchId"));

    if (!Number.isFinite(batchId)) {
      return NextResponse.json({ error: "A numeric batchId query parameter is required." }, { status: 400 });
    }

    const candidates = await context.repositories.importCandidates.listByBatch(batchId);
    return NextResponse.json({ batchId, candidates: candidates.map(serializeStoredImportCandidate) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read import diff" },
      { status: 500 },
    );
  } finally {
    await context.client.close();
  }
}
