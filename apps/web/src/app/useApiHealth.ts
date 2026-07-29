import { useQuery } from '@tanstack/react-query';
import { livenessResponseSchema } from '@pamagochi/contracts';
import type { ApiClient } from '../lib/api-client.js';
import type { ApiStatus } from '../components/ApiStatusBadge.js';

export function useApiHealth(apiClient: ApiClient): ApiStatus {
  const query = useQuery({
    queryKey: ['health', 'live'],
    queryFn: () => apiClient.request('/api/health/live', livenessResponseSchema),
    retry: 1,
    refetchInterval: 15_000,
  });

  if (query.isPending) return 'checking';
  return query.isSuccess ? 'online' : 'offline';
}
