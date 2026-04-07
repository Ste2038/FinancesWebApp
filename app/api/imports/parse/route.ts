import { NextResponse } from "next/server";
import { createAppContext } from "@/lib/server/app-context";
import { importSourceFile } from "@/lib/importers/import-source-file";
import { serializeImportCandidate } from "@/lib/importers/import-candidate-serializer";

type UploadedFileLike = Exclude<FormDataEntryValue, string> & {
  name?: string;
};

function isUploadedFile(value: FormDataEntryValue | null): value is UploadedFileLike {
  return (
    typeof value === "object"
    && value !== null
    && "arrayBuffer" in value
    && typeof value.arrayBuffer === "function"
  );
}

export async function POST(request: Request) {
  const context = await createAppContext();

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!isUploadedFile(file)) {
      return NextResponse.json({ error: "Expected a source file upload in `file`." }, { status: 400 });
    }

    const result = await importSourceFile(context, {
      bytes: Buffer.from(await file.arrayBuffer()),
      fileName: file.name || "source-import",
      sourceChannel: "web",
    });

    return NextResponse.json({
      batchId: result.batchId,
      reused: result.reused,
      counts: result.counts,
      candidates: result.candidates.map((candidate) =>
        serializeImportCandidate({
          entityType: candidate.entityType,
          entityKey: candidate.entityKey,
          action: candidate.action,
          local: candidate.local as Record<string, unknown> | undefined,
          incoming: candidate.incoming as Record<string, unknown> | undefined,
          diff: candidate.diff,
        })),
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
