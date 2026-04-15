import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sendChatMessage, type SendChatMessageInput } from '../api/chat.api';

export function useSendMessage(articleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SendChatMessageInput) => sendChatMessage(articleId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat', articleId] });
    },
  });
}
