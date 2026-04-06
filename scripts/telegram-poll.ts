import { loadEnvConfig } from "@next/env";
import { startTelegramPolling } from "../lib/telegram/poller";

async function main() {
  loadEnvConfig(process.cwd());
  await startTelegramPolling();
}

if (process.argv[1]?.endsWith("telegram-poll.ts")) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
