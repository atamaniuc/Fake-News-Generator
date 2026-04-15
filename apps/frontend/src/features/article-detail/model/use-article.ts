import { useQuery } from '@tanstack/react-query';
import { fetchArticle } from '../api/article.api';

export function useArticle(id: string) {
  return useQuery({
    queryKey: ['article', id],
    queryFn: () => fetchArticle(id),
    enabled: !!id,
  });
}

