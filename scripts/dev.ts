import { spawn, type ChildProcess } from "child_process";
import { loadEnvConfig } from "@next/env";
import { createRequire } from "module";
import { readRuntimeEnv } from "../lib/config/env";

const require = createRequire(import.meta.url);
const nextBinPath = require.resolve("next/dist/bin/next");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const LOG_PREFIX = "[server]";

function spawnProcess(command: string, args: string[], label: string) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });

  child.on("error", (error) => {
    console.error(`${LOG_PREFIX} Failed to start ${label}: ${error.message}`);
  });

  return child;
}

function terminateChild(child: ChildProcess | undefined) {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  child.kill("SIGTERM");
}

function getNextMode() {
  const mode = process.argv[2];
  if (mode === "start") {
    return "start";
  }

  return "dev";
}

async function main() {
  loadEnvConfig(process.cwd());

  const env = readRuntimeEnv();
  const nextMode = getNextMode();
  const nextArgs = [nextBinPath, nextMode, ...process.argv.slice(3)];
  const nextLabel = nextMode === "dev" ? "Next.js dev server" : "Next.js server";
  const nextChild = spawnProcess(process.execPath, nextArgs, nextLabel);
  let pollerChild: ChildProcess | undefined;

  if (env.telegramToken) {
    console.info(`${LOG_PREFIX} Telegram polling is enabled; starting poller companion process`);
    pollerChild = spawnProcess(npmCommand, ["run", "telegram:poll"], "Telegram poller");
  } else {
    console.warn(`${LOG_PREFIX} TELEGRAM_BOT_TOKEN is missing; skipping Telegram poller startup`);
  }

  let isShuttingDown = false;

  function shutdown(signal: string) {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    console.info(`${LOG_PREFIX} Received ${signal}, shutting down child processes`);
    terminateChild(pollerChild);
    terminateChild(nextChild);
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("exit", () => shutdown("exit"));

  nextChild.on("exit", (code, signal) => {
    terminateChild(pollerChild);

    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exitCode = code ?? 0;
  });

  if (pollerChild) {
    pollerChild.on("exit", (code, signal) => {
      if (isShuttingDown) {
        return;
      }

      if (signal) {
        console.warn(`${LOG_PREFIX} Telegram poller stopped with signal ${signal}`);
      } else if ((code ?? 0) !== 0) {
        console.warn(`${LOG_PREFIX} Telegram poller exited with code ${code ?? 0}`);
      }
    });
  }
}

if (process.argv[1]?.endsWith("dev.ts")) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
