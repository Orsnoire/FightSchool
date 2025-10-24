import { useEffect, useRef } from 'react';
import 'katex/dist/katex.min.css';
import { renderToString } from 'katex';

interface RichContentRendererProps {
  html: string;
  className?: string;
}

export function RichContentRenderer({ html, className = '' }: RichContentRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    container.innerHTML = html;

    const mathElements = container.querySelectorAll('.math-inline');
    mathElements.forEach((element) => {
      const latex = element.getAttribute('data-latex');
      if (latex) {
        try {
          element.innerHTML = renderToString(latex, { throwOnError: false });
        } catch (error) {
          console.error('Failed to render LaTeX:', error);
        }
      }
    });
  }, [html]);

  return (
    <div
      ref={containerRef}
      className={`prose max-w-none ${className}`}
      data-testid="rich-content"
    />
  );
}
