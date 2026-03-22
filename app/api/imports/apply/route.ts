import { NextResponse } from "next/server";
import { applyImportSelections } from "@/lib/importers/phone-sqlite/apply-import";
import { createAppContext } from "@/lib/server/app-context";

export async function POST(request: Request) {
  const context = await createAppContext();

  try {
    const payload = await request.json();
    const batchId = Number(payload.batchId);
    const selections = Array.isArray(payload.selections) ? payload.selections : [];

    if (!Number.isFinite(batchId)) {
      return NextResponse.json({ error: "A numeric batchId is required." }, { status: 400 });
    }

    await context.client.exec("BEGIN");

    try {
      const summary = await applyImportSelections(
        {
          accountGroupsRepository: context.repositories.accountGroups,
          accountsRepository: context.repositories.accounts,
          categoriesRepository: context.repositories.categories,
          transactionsRepository: context.repositories.transactions,
          importCandidatesRepository: context.repositories.importCandidates,
        },
        batchId,
        selections,
      );

      await context.repositories.importBatches.markImported(batchId);
      await context.client.exec("COMMIT");

      return NextResponse.json({ batchId, summary });
    } catch (error) {
      await context.client.exec("ROLLBACK");
      throw error;
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to apply import" },
      { status: 500 },
    );
  } finally {
    await context.client.close();
  }
}
