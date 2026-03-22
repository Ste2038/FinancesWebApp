export interface TelegramBotConfig {
  token?: string;
  allowedChatIds: number[];
  webhookSecret?: string;
  webhookPath: string;
}

export interface TelegramCommandEnvelope {
  chatId: number;
  userId?: number;
  text: string;
}

export interface TelegramExpenseCommand {
  amount: number;
  memo?: string;
  categoryName?: string;
  accountName?: string;
}
