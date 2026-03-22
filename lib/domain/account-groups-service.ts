import { AccountGroupInput } from "./models";
import { AccountGroupsRepository } from "../db/repositories/account-groups-repository";

export interface AccountGroupsService {
  listAccountGroups(): Promise<unknown[]>;
  upsertAccountGroup(input: AccountGroupInput): Promise<void>;
  archiveAccountGroup(sourceUid: string): Promise<void>;
}

export function createAccountGroupsService(
  repository: AccountGroupsRepository,
): AccountGroupsService {
  return {
    async listAccountGroups() {
      return repository.list();
    },
    async upsertAccountGroup(input: AccountGroupInput) {
      await repository.upsert(input);
    },
    async archiveAccountGroup(sourceUid: string) {
      await repository.softDelete(sourceUid);
    },
  };
}
