/** Retention helpers — hard-delete eligibility is enforced by E6 jobs. */

const SOFT_DELETE_RETENTION_DAYS = 30;

export function isMemoryVisible(status: string, deletedAt: Date | null | undefined): boolean {
  if (status === 'deleted') return false;
  if (status === 'disabled') return false;
  if (deletedAt) return false;
  return status === 'active';
}

export function isEligibleForHardDelete(
  deletedAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!deletedAt) return false;
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - SOFT_DELETE_RETENTION_DAYS);
  return deletedAt.getTime() <= cutoff.getTime();
}

export function activeMemoryWhere(childId: string) {
  return {
    childId,
    status: 'active' as const,
    deletedAt: null,
  };
}
