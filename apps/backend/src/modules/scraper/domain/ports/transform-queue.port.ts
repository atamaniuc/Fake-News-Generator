export interface TransformQueuePort {
  enqueueTransform(articleId: string): Promise<void>;
}
