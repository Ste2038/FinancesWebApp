export function isTelegramIdentityAllowed(
  identityId: number | string | undefined,
  allowedIds: number[],
): boolean {
  if (identityId === undefined || identityId === null) {
    return false;
  }

  const numericId = Number(identityId);
  return Number.isFinite(numericId) && allowedIds.includes(numericId);
}
