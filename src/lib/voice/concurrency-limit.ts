/** Org/user concurrent-call caps from the backend — user-facing, not bugs. */

const CONCURRENCY_LIMIT = /concurrency limit reached/i;

export function isConcurrencyLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return CONCURRENCY_LIMIT.test(message);
}

export function concurrencyLimitCopy(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/user concurrency/i.test(message)) {
    return "You've reached your concurrent call limit. End an active call, then try again.";
  }
  return "Your organization has reached its concurrent call limit. End an active call or wait for one to finish, then try again.";
}
