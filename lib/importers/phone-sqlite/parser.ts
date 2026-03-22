import { createSqliteClient } from "../../db/client";
import { readRuntimeEnv } from "../../config/env";
import {
  NormalizedPhoneSnapshot,
  PhoneAssetGroupRow,
  PhoneAssetRow,
  PhoneCategoryRow,
  PhoneDatabaseSnapshot,
  PhoneIncomeOutcomeRow,
} from "./types";

async function readTable<T extends Record<string, unknown>>(
  databasePath: string,
  tableName: string,
): Promise<T[]> {
  const client = createSqliteClient({ databasePath });
  try {
    return await client.query<T>(`SELECT * FROM ${tableName}`);
  } finally {
    await client.close();
  }
}

export async function readPhoneDatabaseSnapshot(
  databasePath: string,
): Promise<PhoneDatabaseSnapshot> {
  return {
    assetGroups: await readTable<PhoneAssetGroupRow>(databasePath, "ASSETGROUP"),
    assets: await readTable<PhoneAssetRow>(databasePath, "ASSETS"),
    categories: await readTable<PhoneCategoryRow>(databasePath, "ZCATEGORY"),
    transactions: await readTable<PhoneIncomeOutcomeRow>(databasePath, "INOUTCOME"),
  };
}

export async function readSnapshotFromConfiguredEnv(): Promise<PhoneDatabaseSnapshot> {
  const env = readRuntimeEnv();
  return readPhoneDatabaseSnapshot(env.databasePath);
}

export function emptyNormalizedSnapshot(): NormalizedPhoneSnapshot {
  return {
    accountGroups: [],
    accounts: [],
    categories: [],
    transactions: [],
  };
}
