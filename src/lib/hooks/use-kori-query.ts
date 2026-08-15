import { useQuery, type UseQueryOptions, type UseQueryResult } from "@tanstack/react-query";
import { KoriApiError } from "@/lib/api/kori-errors";
import { useWorkspaceScopeKey } from "@/context/session-context";

export function useKoriQuery<T>(
  options: Omit<UseQueryOptions<T, KoriApiError>, "retry"> & {
    retry?: number;
    skipWorkspaceScope?: boolean;
  },
): UseQueryResult<T, KoriApiError> {
  const workspaceKey = useWorkspaceScopeKey();
  const { skipWorkspaceScope, queryKey, ...rest } = options;
  const scopedKey =
    skipWorkspaceScope || !queryKey ? queryKey : [...queryKey, "ws", workspaceKey];

  return useQuery({
    retry: 1,
    ...rest,
    queryKey: scopedKey,
  });
}
