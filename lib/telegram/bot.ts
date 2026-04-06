import { readRuntimeEnv } from "../config/env";
import { isTelegramIdentityAllowed } from "./authorization";
import { parseTelegramMessage } from "./message-parser";
import { TelegramBotConfig, TelegramCommandEnvelope } from "./types";

export interface TelegramBotDependencies {
  onAddExpense(input: { chatId: number; amount: number; memo?: string }): Promise<void>;
  onSummaryRequest(input: { chatId: number }): Promise<string>;
}

export function createTelegramBotConfig(): TelegramBotConfig {
  const env = readRuntimeEnv();
  return {
    token: env.telegramToken,
    allowedChatIds: env.telegramAllowedIds,
  };
}

export async function handleTelegramEnvelope(
  envelope: TelegramCommandEnvelope,
  dependencies: TelegramBotDependencies,
): Promise<string> {
  const config = createTelegramBotConfig();
  if (!isTelegramIdentityAllowed(envelope.chatId, config.allowedChatIds)) {
    console.warn(
      `[telegram] Rejected message from not allowed id: ${JSON.stringify({
        chatId: envelope.chatId,
        userId: envelope.userId ?? null,
        text: envelope.text,
      })}`,
    );
    throw new Error("Telegram chat is not allowed");
  }

  const parsed = parseTelegramMessage(envelope.text);
  if (parsed.name === "add_expense" && parsed.expense) {
    await dependencies.onAddExpense({
      chatId: envelope.chatId,
      amount: parsed.expense.amount,
      memo: parsed.expense.memo,
    });
    return "Expense recorded";
  }

  if (parsed.name === "summary") {
    return dependencies.onSummaryRequest({ chatId: envelope.chatId });
  }

  return "Unknown command";
}
