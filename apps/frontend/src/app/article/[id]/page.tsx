import { ArticleDetailPage } from '../../../features/article-detail/ui/ArticleDetailPage';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ArticleDetailPage articleId={id} />;
}

