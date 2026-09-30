import { useEffect, useRef } from 'react';
import 'katex/dist/katex.min.css';
import { renderRichContent } from '@/lib/richContent';

interface RichContentRendererProps {
  html: string;
  className?: string;
}

export function RichContentRenderer({ html, className = '' }: RichContentRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    renderRichContent(containerRef.current, html);
  }, [html]);

  return (
    <div
      ref={containerRef}
      className={`prose max-w-none whitespace-pre-wrap break-words [&_svg]:max-w-full [&_svg]:h-auto [&_img]:max-w-full ${className}`}
      data-testid="rich-content"
    />
  );
}
