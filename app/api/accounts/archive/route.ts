import { NextResponse } from "next/server";
import { createAppContext } from "@/lib/server/app-context";

type ArchiveAction = "archive" | "restore";

export async function POST(request: Request) {
  const context = await createAppContext();

  try {
    const payload = await request.json();
    const action: ArchiveAction = payload.action === "restore" ? "restore" : "archive";
    const rawSourceUids: unknown[] = Array.isArray(payload.sourceUids) ? payload.sourceUids : [];
    const sourceUids = rawSourceUids.length > 0
      ? [
          ...new Set(
            rawSourceUids
              .filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0)
              .map((value: string) => value.trim()),
          ),
        ]
      : [];

    if (sourceUids.length === 0) {
      return NextResponse.json({ error: `Select at least one account to ${action}.` }, { status: 400 });
    }

    const changedCount =
      action === "restore"
        ? await context.repositories.accounts.unarchiveMany(sourceUids)
        : await context.repositories.accounts.archiveMany(sourceUids);

    return NextResponse.json({ action, changedCount });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to archive accounts" },
      { status: 500 },
    );
  } finally {
    await context.client.close();
  }
}
