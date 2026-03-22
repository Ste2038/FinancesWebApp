import { NextResponse } from "next/server";
import { createAppContext } from "@/lib/server/app-context";

export async function GET() {
  const context = await createAppContext();

  try {
    const batches = await context.repositories.importBatches.listRecent();
    return NextResponse.json({ batches });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load import queue" },
      { status: 500 },
    );
  } finally {
    await context.client.close();
  }
}
