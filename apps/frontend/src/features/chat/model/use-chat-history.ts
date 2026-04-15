import { useQuery } from '@tanstack/react-query';
import { fetchChatHistory } from '../api/chat.api';

export function useChatHistory(articleId: string) {
  return useQuery({
    queryKey: ['chat', articleId],
    queryFn: () => fetchChatHistory(articleId),
    enabled: !!articleId,
  });
}

