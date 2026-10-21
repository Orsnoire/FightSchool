export interface MathTextPart {
  text: string;
  latex?: string;
  display?: boolean;
}

// Infer only unmistakable notation. Delimit ambiguous formulas with \( ... \).
const functions = new Set(["sin", "cos", "tan", "sec", "csc", "cot", "arcsin", "arccos", "arctan", "ln", "log", "exp"]);
const commands = new Set([
  ...functions, "frac", "dfrac", "tfrac", "sqrt", "int", "iint", "sum", "prod",
  "lim", "infty", "pi", "theta", "alpha", "beta", "delta", "Delta", "sigma",
  "left", "right", "lvert", "rvert", "cdot", "times", "div", "pm", "mp",
  "le", "leq", "ge", "geq", "ne", "neq", "approx", "to", "partial",
  "mathrm", "mathbf", "displaystyle",
]);

function bareMath(text: string): MathTextPart[] {
  const parts: MathTextPart[] = [];
  const tokens = /\\(?:[A-Za-z]+|[,;! ])|[A-Za-z]+|\d+(?:\.\d+)?|[ \t]+|[{}()[\]^_+\-*/=<>|]/g;
  let runStart = -1;
  let runEnd = 0;
  let emitted = 0;
  let hasNotation = false;
  const flush = () => {
    if (runStart >= 0 && hasNotation && !/^[\s^_]*[_^]/.test(text.slice(runStart, runEnd))) {
      const run = text.slice(runStart, runEnd);
      const candidate = run.trim();
      const start = runStart + run.indexOf(candidate);
      if (start > emitted) parts.push({ text: text.slice(emitted, start) });
      const latex = candidate
        .replace(/([_^])([+-]?\d+(?:\.\d+)?)/g, "$1{$2}")
        .replace(/([_^])\(([^()]+)\)/g, "$1{$2}")
        .replace(/\b(sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|ln|log|exp)\b/g,
          (name, _group, offset, source) => source[offset - 1] === "\\" ? name : "\\" + name);
      parts.push({ text: candidate, latex });
      emitted = start + candidate.length;
    }
    runStart = -1;
    hasNotation = false;
  };
  for (const token of text.matchAll(tokens)) {
    const value = token[0];
    const index = token.index!;
    const word = /^[A-Za-z]+$/.test(value);
    const command = value.startsWith("\\");
    const allowed = word ? value.length === 1 || functions.has(value) :
      command ? commands.has(value.slice(1)) || /^\\[,;! ]$/.test(value) : true;
    if (!allowed || (runStart >= 0 && index !== runEnd)) flush();
    if (!allowed) continue;
    if (runStart < 0) runStart = index;
    runEnd = index + value.length;
    if (value === "^" || value === "_" || (command && commands.has(value.slice(1)))) hasNotation = true;
  }
  flush();
  if (emitted < text.length) parts.push({ text: text.slice(emitted) });
  return parts;
}

function delimitedMath(text: string): MathTextPart[] {
  const parts: MathTextPart[] = [];
  const delimiters = /(?<!\\)\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|(?<!\\)\$(?!\$)([^\n$]+?)(?<!\\)\$(?!\$)/g;
  let end = 0;
  for (const match of text.matchAll(delimiters)) {
    // "$5 and $10" is currency, not an inline math pair.
    if (match[4] !== undefined && match[4] !== match[4].trim()) continue;
    parts.push(...bareMath(text.slice(end, match.index)));
    parts.push({
      text: match[0],
      latex: match[1] ?? match[2] ?? match[3] ?? match[4],
      display: match[1] !== undefined || match[2] !== undefined,
    });
    end = match.index! + match[0].length;
  }
  parts.push(...bareMath(text.slice(end)));
  return parts;
}

export function splitMathText(text: string): MathTextPart[] {
  const parts: MathTextPart[] = [];
  const addresses = /(?:https?:\/\/|www\.)[^\s]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\b[A-Za-z][A-Za-z0-9]+(?:_[A-Za-z0-9]+)+\b/g;
  let end = 0;
  for (const match of text.matchAll(addresses)) {
    parts.push(...delimitedMath(text.slice(end, match.index)));
    parts.push({ text: match[0] });
    end = match.index! + match[0].length;
  }
  parts.push(...delimitedMath(text.slice(end)));
  return parts;
}
