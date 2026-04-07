export interface TelegramUser {
  id: number;
}

export interface TelegramChat {
  id: number;
}

export interface TelegramDocument {
  file_id: string;
  file_name?: string;
  mime_type?: string;
}

export interface TelegramMessage {
  chat?: TelegramChat;
  from?: TelegramUser;
  text?: string;
  document?: TelegramDocument;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
}

interface TelegramFile {
  file_path: string;
}

interface TelegramApiEnvelope<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

async function callTelegramApi<T>(
  token: string,
  method: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const envelope = (await response.json()) as TelegramApiEnvelope<T>;
  if (!response.ok || !envelope.ok || envelope.result === undefined) {
    throw new Error(envelope.description ?? `Telegram API call failed: ${method}`);
  }

  return envelope.result;
}

export async function deleteTelegramWebhook(
  token: string,
  dropPendingUpdates = false,
): Promise<void> {
  await callTelegramApi(token, "deleteWebhook", {
    drop_pending_updates: dropPendingUpdates,
  });
}

export async function getTelegramUpdates(
  token: string,
  options: {
    offset: number;
    timeoutSeconds?: number;
  },
): Promise<TelegramUpdate[]> {
  return callTelegramApi<TelegramUpdate[]>(token, "getUpdates", {
    allowed_updates: ["message", "edited_message"],
    offset: options.offset,
    timeout: options.timeoutSeconds ?? 30,
  });
}

export async function sendTelegramMessage(
  token: string,
  chatId: number,
  text: string,
): Promise<void> {
  await callTelegramApi(token, "sendMessage", {
    chat_id: chatId,
    text,
  });
}

export async function getTelegramFile(token: string, fileId: string): Promise<TelegramFile> {
  return callTelegramApi<TelegramFile>(token, "getFile", {
    file_id: fileId,
  });
}

export async function downloadTelegramFile(token: string, filePath: string): Promise<Buffer> {
  const response = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
  if (!response.ok) {
    throw new Error(`Telegram file download failed with status ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}
