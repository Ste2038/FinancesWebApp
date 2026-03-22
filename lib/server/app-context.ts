import { readRuntimeEnv } from "../config/env";
import { resolveProjectPath } from "../config/paths";
import { createSqliteClient } from "../db/client";
import { runMigrations } from "../db/migrate";
import { createAccountGroupsRepository } from "../db/repositories/account-groups-repository";
import { createAccountsRepository } from "../db/repositories/accounts-repository";
import { createCategoriesRepository } from "../db/repositories/categories-repository";
import { createImportBatchesRepository } from "../db/repositories/import-batches-repository";
import { createImportCandidatesRepository } from "../db/repositories/import-candidates-repository";
import { createTransactionsRepository } from "../db/repositories/transactions-repository";

export async function createAppContext() {
  const env = readRuntimeEnv();
  const client = createSqliteClient({
    databasePath: resolveProjectPath(env.databasePath),
  });

  await runMigrations(client);

  return {
    env,
    client,
    repositories: {
      accountGroups: createAccountGroupsRepository(client),
      accounts: createAccountsRepository(client),
      categories: createCategoriesRepository(client),
      transactions: createTransactionsRepository(client),
      importBatches: createImportBatchesRepository(client),
      importCandidates: createImportCandidatesRepository(client),
    },
  };
}
