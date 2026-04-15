import { useQuery } from '@tanstack/react-query';
import { fetchArticles } from '../api/articles.api';

export function useArticles(params: { source?: string | null; page: number; limit: number }) {
  return useQuery({
    queryKey: ['articles', params],
    queryFn: () => fetchArticles(params),
    // Transforms happen asynchronously in the background; keep the list fresh until we have something to show.
    refetchInterval: (q) => {
      const data = q.state.data;
      if (data && Array.isArray(data.data) && data.data.length > 0) return false;
      return 5000;
    },
  });
}
