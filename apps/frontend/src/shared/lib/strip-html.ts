export function stripHtmlToText(input: string): string {
  const raw = (input ?? '').trim();
  if (!raw) return '';

  // Add minimal formatting before stripping tags so lists/paragraphs remain readable.
  const withMarkers = raw
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*p\s*>/gi, '\n\n')
    .replace(/<\s*\/\s*div\s*>/gi, '\n\n')
    .replace(/<\s*\/\s*li\s*>/gi, '\n')
    .replace(/<\s*li(\s+[^>]*)?>/gi, '• ')
    .replace(/<\s*\/\s*ul\s*>/gi, '\n')
    .replace(/<\s*\/\s*ol\s*>/gi, '\n');

  // Strip remaining tags.
  const stripped = withMarkers.replace(/<[^>]*>/g, '');

  // Decode HTML entities in the browser; in non-browser contexts keep as-is.
  const decoded =
    typeof document !== 'undefined'
      ? (() => {
          const textarea = document.createElement('textarea');
          textarea.innerHTML = stripped;
          return textarea.value;
        })()
      : stripped;

  return decoded.replace(/\n{3,}/g, '\n\n').trim();
}

