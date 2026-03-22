import { NextResponse } from "next/server";
import { createSourceFingerprint } from "@/lib/importers/phone-sqlite/fingerprint";
import { handleTelegramEnvelope } from "@/lib/telegram/bot";
import { createAppContext } from "@/lib/server/app-context";
import { getDashboardSnapshot } from "@/lib/server/dashboard";

function formatSummaryMessage(snapshot: Awaited<ReturnType<typeof getDashboardSnapshot>>) {
  return [
    `Net flow: EUR ${snapshot.balances.netFlow.toFixed(2)}`,
    `Income: EUR ${snapshot.balances.income.toFixed(2)}`,
    `Expenses: EUR ${snapshot.balances.expenses.toFixed(2)}`,
    `Transactions: ${snapshot.totals.transactions}`,
    `Accounts: ${snapshot.totals.accounts}`,
  ].join("\n");
}

export async function POST(request: Request) {
  const context = await createAppContext();

  try {
    if (context.env.telegramWebhookSecret) {
      const headerSecret = request.headers.get("x-telegram-bot-api-secret-token");
      if (headerSecret !== context.env.telegramWebhookSecret) {
        return NextResponse.json({ error: "Invalid Telegram webhook secret" }, { status: 401 });
      }
    }

    const payload = await request.json();
    const message = payload.message ?? payload.edited_message;
    const chatId = message?.chat?.id;
    const userId = message?.from?.id;
    const text = message?.text;

    if (!chatId || typeof text !== "string") {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const reply = await handleTelegramEnvelope(
      {
        chatId,
        userId,
        text,
      },
      {
        onAddExpense: async ({ chatId: requestChatId, amount, memo }) => {
          const sourceUid = `telegram:${requestChatId}:${Date.now()}`;
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
      },
    );

    return NextResponse.json({ ok: true, reply });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Telegram webhook failed" },
      { status: 500 },
    );
  } finally {
    await context.client.close();
  }
}
