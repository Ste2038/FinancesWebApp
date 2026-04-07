import { importSourceFile } from "../importers/import-source-file";
import { createSourceFingerprint } from "../importers/phone-sqlite/fingerprint";
import { createAppContext } from "../server/app-context";
import { getDashboardSnapshot } from "../server/dashboard";
import { downloadTelegramFile, getTelegramFile } from "./api";
import { assertTelegramIdentityAllowed, handleTelegramEnvelope } from "./bot";
import { TelegramCommandEnvelope, TelegramDocumentEnvelope } from "./types";

function formatSummaryMessage(snapshot: Awaited<ReturnType<typeof getDashboardSnapshot>>) {
  return [
    `Net flow: EUR ${snapshot.balances.netFlow.toFixed(2)}`,
    `Income: EUR ${snapshot.balances.income.toFixed(2)}`,
    `Expenses: EUR ${snapshot.balances.expenses.toFixed(2)}`,
    `Transactions: ${snapshot.totals.transactions}`,
    `Accounts: ${snapshot.totals.accounts}`,
  ].join("\n");
}

export async function processTelegramEnvelope(
  envelope: TelegramCommandEnvelope,
): Promise<string> {
  const context = await createAppContext();

  try {
    return await handleTelegramEnvelope(envelope, {
      onAddExpense: async ({ chatId, amount, memo }) => {
        const sourceUid = `telegram:${chatId}:${Date.now()}`;
        await context.repositories.transactions.upsert({
          sourceUid,
          sourceHash: createSourceFingerprint({ sourceUid, amount, memo }),
          sourceDeleted: false,
          accountSourceUid: null,
          targetAccountSourceUid: null,
          categorySourceUid: null,
          transactionType: 1,
          transactionDate: new Date().toISOString().slice(0, 10),
          bookedAt: new Date().toISOString(),
          paidAt: null,
          amount: Math.abs(amount),
          amountAccount: Math.abs(amount),
          memo: memo ?? null,
          content: memo ?? "Telegram expense",
          payee: null,
          smsOrigin: null,
          isPaid: true,
          origin: "telegram",
        });
      },
      onSummaryRequest: async () => {
        const snapshot = await getDashboardSnapshot();
        return formatSummaryMessage(snapshot);
      },
    });
  } finally {
    await context.client.close();
  }
}

function isPdfDocument(input: TelegramDocumentEnvelope["document"]) {
  return input.mimeType === "application/pdf"
    || input.fileName?.toLocaleLowerCase("en-US").endsWith(".pdf")
    || false;
}

export async function processTelegramDocumentEnvelope(
  token: string,
  envelope: TelegramDocumentEnvelope,
): Promise<string> {
  assertTelegramIdentityAllowed({
    chatId: envelope.chatId,
    userId: envelope.userId,
    description: `document ${JSON.stringify({ fileName: envelope.document.fileName ?? null })}`,
  });

  if (!isPdfDocument(envelope.document)) {
    return "Only PDF documents are supported for imports.";
  }

  const telegramFile = await getTelegramFile(token, envelope.document.fileId);
  const bytes = await downloadTelegramFile(token, telegramFile.file_path);
  const context = await createAppContext();

  try {
    try {
      const result = await importSourceFile(context, {
        bytes,
        fileName: envelope.document.fileName ?? "telegram-statement.pdf",
        sourceChannel: "telegram",
      });

      return result.reused
        ? `Batch ${result.batchId} already exists with ${result.candidates.length} candidates. Review it on the website.`
        : `Batch ${result.batchId} created with ${result.candidates.length} candidates. Review it on the website.`;
    } catch (error) {
      return `Failed to import PDF: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  } finally {
    await context.client.close();
  }
}
