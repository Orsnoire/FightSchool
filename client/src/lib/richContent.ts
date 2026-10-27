import createDOMPurify from "dompurify";
import { renderToString } from "katex";
import { splitMathText } from "./mathText";

function mathMarkup(latex: string, display = false): string | null {
  try {
    return renderToString(latex, { throwOnError: true, trust: false, displayMode: display });
  } catch {
    return null;
  }
}

// One display path for student content and teacher previews. Never rewrite the
// stored HTML: imported SVG graphs must survive opening and saving a fight.
export function renderRichContent(container: HTMLElement, content: string) {
  if (!/<\/?(?:p|div|span|section|strong|em|b|i|u|s|del|sub|sup|br|hr|h[1-6]|ul|ol|li|blockquote|pre|code|a|img|table|thead|tbody|tfoot|tr|th|td|svg|math|script|style|iframe|object|embed)\b[^>]*>/i.test(content)) {
    container.textContent = content;
  } else {
    const window = container.ownerDocument.defaultView;
    if (!window) return;
    const purifier = createDOMPurify(window);
    container.innerHTML = purifier.sanitize(content, {
      USE_PROFILES: { html: true, svg: true, mathMl: true },
      FORBID_TAGS: ["style"],
    });
  }

  container.querySelectorAll(".math-inline[data-latex], .math-display[data-latex]").forEach((element) => {
    const latex = element.getAttribute("data-latex");
    if (latex) {
      const markup = mathMarkup(latex, element.classList.contains("math-display"));
      if (markup) element.innerHTML = markup;
      else element.textContent = latex;
    }
  });

  const document = container.ownerDocument;
  const walker = document.createTreeWalker(container, 4 /* SHOW_TEXT */);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    if (node.parentElement?.closest(".math-inline, .math-display, .katex, math, svg, pre, code, a, textarea, script, style")) continue;
    const parts = splitMathText(node.data);
    if (!parts.some(part => part.latex)) continue;
    const fragment = document.createDocumentFragment();
    for (const part of parts) {
      const markup = part.latex ? mathMarkup(part.latex, part.display) : null;
      if (!markup) {
        fragment.append(document.createTextNode(part.text));
        continue;
      }
      const math = document.createElement("span");
      math.className = part.display ? "math-display" : "math-inline";
      math.dataset.latex = part.latex;
      math.innerHTML = markup;
      fragment.append(math);
    }
    node.replaceWith(fragment);
  }
}
