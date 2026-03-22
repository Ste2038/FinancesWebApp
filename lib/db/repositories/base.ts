export function notImplemented(feature: string): never {
  throw new Error(`${feature} is not implemented yet`);
}

export interface RepositoryContext {
  databasePath: string;
}
