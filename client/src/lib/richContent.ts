import createDOMPurify from "dompurify";
import { renderToString } from "katex";

// One display path for student content and teacher previews. Never rewrite the
// stored HTML: imported SVG graphs must survive opening and saving a fight.
export function renderRichContent(container: HTMLElement, content: string) {
  if (!/<\/?[a-z][\s\S]*>/i.test(content)) {
    container.textContent = content;
    return;
  }

  const window = container.ownerDocument.defaultView;
  if (!window) return;
  const purifier = createDOMPurify(window);
  container.innerHTML = purifier.sanitize(content, {
    USE_PROFILES: { html: true, svg: true, mathMl: true },
    FORBID_TAGS: ["style"],
  });

  container.querySelectorAll(".math-inline[data-latex]").forEach((element) => {
    const latex = element.getAttribute("data-latex");
    if (latex) {
      element.innerHTML = renderToString(latex, {
        throwOnError: false,
        trust: false,
      });
    }
  });
}
