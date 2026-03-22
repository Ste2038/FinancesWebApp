import { resolve } from "node:path";

export const PROJECT_ROOT = process.cwd();

export function resolveProjectPath(...segments: string[]): string {
  return resolve(PROJECT_ROOT, ...segments);
}

export function resolveDataPath(...segments: string[]): string {
  return resolve(PROJECT_ROOT, "data", ...segments);
}
