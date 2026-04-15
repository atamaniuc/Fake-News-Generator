export type LlmChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export interface LlmPort {
  completeChat(messages: LlmChatMessage[]): Promise<string>;
  streamChat(messages: LlmChatMessage[]): AsyncIterable<string>;
}
