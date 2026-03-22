import { TransactionInput } from "./models";
import { TransactionsRepository } from "../db/repositories/transactions-repository";

export interface TransactionsService {
  listTransactions(): Promise<unknown[]>;
  upsertTransaction(input: TransactionInput): Promise<void>;
  archiveTransaction(sourceUid: string): Promise<void>;
}

export function createTransactionsService(
  repository: TransactionsRepository,
): TransactionsService {
  return {
    async listTransactions() {
      return repository.list();
    },
    async upsertTransaction(input: TransactionInput) {
      await repository.upsert(input);
    },
    async archiveTransaction(sourceUid: string) {
      await repository.softDelete(sourceUid);
    },
  };
}
