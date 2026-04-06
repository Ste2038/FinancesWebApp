import { createSourceFingerprint } from "../importers/phone-sqlite/fingerprint";
import { createAppContext } from "../server/app-context";
import { getDashboardSnapshot } from "../server/dashboard";
import { handleTelegramEnvelope } from "./bot";
import { TelegramCommandEnvelope } from "./types";

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
          amount: -Math.abs(amount),
          amountAccount: -Math.abs(amount),
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
