import { createTelegramBotConfig } from "./bot";
import {
  deleteTelegramWebhook,
  getTelegramUpdates,
  sendTelegramMessage,
  TelegramUpdate,
} from "./api";
import { processTelegramEnvelope } from "./service";

const POLL_TIMEOUT_SECONDS = 30;
const RETRY_DELAY_MS = 3_000;

interface TelegramPollerState {
  hasRegisteredSignalHandlers: boolean;
  isRunning: boolean;
  shouldStop: boolean;
  loopPromise?: Promise<void>;
  offset: number;
}

const pollerState = getPollerState();

function getPollerState(): TelegramPollerState {
  const globalScope = globalThis as typeof globalThis & {
    __financesTelegramPollerState?: TelegramPollerState;
  };

  if (!globalScope.__financesTelegramPollerState) {
    globalScope.__financesTelegramPollerState = {
      hasRegisteredSignalHandlers: false,
      isRunning: false,
      offset: 0,
      shouldStop: false,
    };
  }

  return globalScope.__financesTelegramPollerState;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stopPolling(signal: string) {
  console.info(`[telegram] Received ${signal}, stopping poller`);
  pollerState.shouldStop = true;
}

function registerSignalHandlers() {
  if (pollerState.hasRegisteredSignalHandlers) {
    return;
  }

  process.on("SIGINT", () => stopPolling("SIGINT"));
  process.on("SIGTERM", () => stopPolling("SIGTERM"));
  pollerState.hasRegisteredSignalHandlers = true;
}

function getEnvelopeFromUpdate(update: TelegramUpdate) {
  const message = update.message ?? update.edited_message;
  const chatId = message?.chat?.id;
  const userId = message?.from?.id;
  const text = message?.text;

  if (!chatId || typeof text !== "string") {
    return null;
  }

  return {
    chatId,
    text,
    userId,
  };
}

async function processUpdate(token: string, update: TelegramUpdate) {
  const envelope = getEnvelopeFromUpdate(update);

  if (!envelope) {
    console.info(`[telegram] Ignored update ${update.update_id} without text content`);
    return;
  }

  console.info(
    `[telegram] Processing update ${update.update_id} from chat ${envelope.chatId}`,
  );

  try {
    const reply = await processTelegramEnvelope(envelope);
    await sendTelegramMessage(token, envelope.chatId, reply);
  } catch (error) {
    console.error(
      `[telegram] Failed to process update ${update.update_id}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
}

async function runTelegramPollingLoop(token: string) {
  console.info("[telegram] Starting long polling");
  await deleteTelegramWebhook(token, false);

  while (!pollerState.shouldStop) {
    try {
      const updates = await getTelegramUpdates(token, {
        offset: pollerState.offset,
        timeoutSeconds: POLL_TIMEOUT_SECONDS,
      });

      for (const update of updates) {
        await processUpdate(token, update);
        pollerState.offset = update.update_id + 1;
      }
    } catch (error) {
      console.error(
        `[telegram] Polling failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );

      if (!pollerState.shouldStop) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  console.info("[telegram] Poller stopped");
}

export function startTelegramPolling() {
  const config = createTelegramBotConfig();

  if (!config.token) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN");
  }

  if (pollerState.isRunning && pollerState.loopPromise) {
    return pollerState.loopPromise;
  }

  registerSignalHandlers();
  pollerState.shouldStop = false;
  pollerState.isRunning = true;
  pollerState.loopPromise = runTelegramPollingLoop(config.token).finally(() => {
    pollerState.isRunning = false;
    pollerState.loopPromise = undefined;
  });

  return pollerState.loopPromise;
}
