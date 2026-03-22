import { TelegramExpenseCommand } from "./types";

export interface ParsedTelegramCommand {
  name: "add_expense" | "summary" | "unknown";
  rawText: string;
  expense?: TelegramExpenseCommand;
}

export function parseTelegramMessage(text: string): ParsedTelegramCommand {
  const normalized = text.trim();

  if (normalized.startsWith("/summary")) {
    return { name: "summary", rawText: text };
  }

  if (normalized.startsWith("/expense")) {
    const parts = normalized.split(/\s+/);
    const amount = Number(parts[1]);
    return {
      name: Number.isFinite(amount) ? "add_expense" : "unknown",
      rawText: text,
      expense: Number.isFinite(amount)
        ? {
            amount,
            memo: parts.slice(2).join(" ") || undefined,
          }
        : undefined,
    };
  }

  return { name: "unknown", rawText: text };
}
