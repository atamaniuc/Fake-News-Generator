import { useQuery } from '@tanstack/react-query';
import { fetchSourcesSummary } from '../api/sources.api';

export function useSourcesSummary() {
  return useQuery({
    queryKey: ['sourcesSummary'],
    queryFn: fetchSourcesSummary,
    // Keep counts reactive while transforms complete in the background.
    refetchInterval: 5000,
  });
}

