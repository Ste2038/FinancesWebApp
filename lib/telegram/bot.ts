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

export function assertTelegramIdentityAllowed(input: {
  chatId: number;
  userId?: number;
  description: string;
}) {
  const config = createTelegramBotConfig();
  if (!isTelegramIdentityAllowed(input.chatId, config.allowedChatIds)) {
    console.warn(
      `[telegram] Rejected ${input.description} from not allowed id: ${JSON.stringify({
        chatId: input.chatId,
        userId: input.userId ?? null,
      })}`,
    );
    throw new Error("Telegram chat is not allowed");
  }
}

export async function handleTelegramEnvelope(
  envelope: TelegramCommandEnvelope,
  dependencies: TelegramBotDependencies,
): Promise<string> {
  assertTelegramIdentityAllowed({
    chatId: envelope.chatId,
    userId: envelope.userId,
    description: `message ${JSON.stringify({ text: envelope.text })}`,
  });

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
