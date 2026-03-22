import { CategoryInput } from "./models";
import { CategoriesRepository } from "../db/repositories/categories-repository";

export interface CategoriesService {
  listCategories(): Promise<unknown[]>;
  upsertCategory(input: CategoryInput): Promise<void>;
  archiveCategory(sourceUid: string): Promise<void>;
}

export function createCategoriesService(
  repository: CategoriesRepository,
): CategoriesService {
  return {
    async listCategories() {
      return repository.list();
    },
    async upsertCategory(input: CategoryInput) {
      await repository.upsert(input);
    },
    async archiveCategory(sourceUid: string) {
      await repository.softDelete(sourceUid);
    },
  };
}
