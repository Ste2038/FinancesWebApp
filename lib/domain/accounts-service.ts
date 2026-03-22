import { AccountInput } from "./models";
import { AccountsRepository } from "../db/repositories/accounts-repository";

export interface AccountsService {
  listAccounts(): Promise<unknown[]>;
  upsertAccount(input: AccountInput): Promise<void>;
  archiveAccount(sourceUid: string): Promise<void>;
}

export function createAccountsService(
  repository: AccountsRepository,
): AccountsService {
  return {
    async listAccounts() {
      return repository.list();
    },
    async upsertAccount(input: AccountInput) {
      await repository.upsert(input);
    },
    async archiveAccount(sourceUid: string) {
      await repository.softDelete(sourceUid);
    },
  };
}
