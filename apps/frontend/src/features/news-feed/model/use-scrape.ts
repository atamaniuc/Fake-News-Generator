import { useMutation, useQueryClient } from '@tanstack/react-query';
import { triggerScrape } from '../api/articles.api';

export function useScrape() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: triggerScrape,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['articles'] });
      qc.invalidateQueries({ queryKey: ['sourcesSummary'] });
    },
  });
}
