const KEY = (agentId: string) => `kupe:db-banner:${agentId}`;

export function markDatabaseCreatedBanner(agentId: string) {
  try {
    sessionStorage.setItem(KEY(agentId), "show");
  } catch {
    /* private mode */
  }
}

export function peekDatabaseCreatedBanner(agentId: string): boolean {
  try {
    return sessionStorage.getItem(KEY(agentId)) === "show";
  } catch {
    return false;
  }
}

export function dismissDatabaseCreatedBanner(agentId: string) {
  try {
    sessionStorage.setItem(KEY(agentId), "done");
  } catch {
    /* private mode */
  }
}
