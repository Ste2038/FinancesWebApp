export interface RuntimeEnv {
  databasePath: string;
  uploadsDir: string;
  telegramToken?: string;
  telegramAllowedIds: number[];
  telegramWebhookSecret?: string;
  telegramWebhookPath: string;
  timeZone: string;
}

function normalizeDatabasePath(input: string | undefined): string {
  if (!input) {
    return "data/app.sqlite";
  }

  if (input.startsWith("file:")) {
    return input.slice("file:".length);
  }

  return input;
}

export function parseAllowedIds(input: string | undefined): number[] {
  if (!input) {
    return [];
  }

  return input
    .split(/[\s,;]+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value));
}

export function readRuntimeEnv(env: NodeJS.ProcessEnv = process.env): RuntimeEnv {
  return {
    databasePath: normalizeDatabasePath(
      env.FINANCES_DB_PATH ?? env.DATABASE_PATH ?? env.SQLITE_PATH ?? env.DATABASE_URL,
    ),
    uploadsDir: env.FINANCES_UPLOADS_DIR ?? env.UPLOADS_DIR ?? "data/uploads",
    telegramToken:
      env.FINANCES_TELEGRAM_TOKEN || env.TELEGRAM_BOT_TOKEN || env.TELEGRAM_TOKEN,
    telegramAllowedIds: parseAllowedIds(
      env.FINANCES_TELEGRAM_ALLOWED_IDS ?? env.TELEGRAM_ALLOWED_IDS,
    ),
    telegramWebhookSecret:
      env.FINANCES_TELEGRAM_WEBHOOK_SECRET ?? env.TELEGRAM_WEBHOOK_SECRET,
    telegramWebhookPath:
      env.FINANCES_TELEGRAM_WEBHOOK_PATH ?? env.TELEGRAM_WEBHOOK_PATH ?? "/api/telegram/webhook",
    timeZone: env.TZ ?? env.FINANCES_TIME_ZONE ?? "Europe/Rome",
  };
}
