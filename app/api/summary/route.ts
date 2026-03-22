import { NextResponse } from "next/server";
import { getDashboardSnapshot } from "@/lib/server/dashboard";

export async function GET() {
  try {
    const snapshot = await getDashboardSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load dashboard summary" },
      { status: 500 },
    );
  }
}
