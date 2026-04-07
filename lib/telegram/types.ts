export interface TelegramBotConfig {
  token?: string;
  allowedChatIds: number[];
}

export interface TelegramCommandEnvelope {
  chatId: number;
  userId?: number;
  text: string;
}

export interface TelegramDocumentReference {
  fileId: string;
  fileName?: string;
  mimeType?: string;
}

export interface TelegramDocumentEnvelope {
  chatId: number;
  userId?: number;
  document: TelegramDocumentReference;
}

export interface TelegramExpenseCommand {
  amount: number;
  memo?: string;
  categoryName?: string;
  accountName?: string;
}
