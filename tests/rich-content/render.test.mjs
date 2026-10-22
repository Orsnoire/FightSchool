import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { renderRichContent } from '../../client/src/lib/richContent.ts';
import { questionsFromCsvRows } from '../../client/src/features/fight-authoring/csv.ts';
import { splitMathText } from '../../client/src/lib/mathText.ts';

function render(content) {
  const document = new JSDOM('<div id="preview"></div>').window.document;
  const element = document.getElementById('preview');
  renderRichContent(element, content);
  return element;
}

test('renders imported HTML and SVG graph elements instead of displaying code', () => {
  const html = '<p>Which function matches?</p><svg viewBox="0 0 400 400" width="400" style="background:white"><polyline points="0,0 100,100" stroke="black"/><text x="10" y="20">-8</text></svg>';
  const result = render(html);
  assert.equal(result.querySelector('p').textContent, 'Which function matches?');
  assert.equal(result.querySelector('svg').getAttribute('viewBox'), '0 0 400 400');
  assert.equal(result.querySelector('polyline').getAttribute('points'), '0,0 100,100');
  assert.equal(result.querySelector('svg text').textContent, '-8');
  assert.ok(!result.textContent.includes('<svg'));
});

test('preserves math metadata and renders it through KaTeX', () => {
  const result = render('<span class="math-inline" data-latex="x^2+1"></span>');
  assert.equal(result.querySelector('.math-inline').getAttribute('data-latex'), 'x^2+1');
  assert.ok(result.querySelector('.katex'));
});

test('keeps plain-text inequalities and line breaks intact', () => {
  const result = render('Is x < 3 and y > 1?\nExplain.');
  assert.equal(result.textContent, 'Is x < 3 and y > 1?\nExplain.');
});

test('removes executable markup while retaining graph geometry', () => {
  const result = render('<script>alert(1)</script><img src="x" onerror="alert(1)"><svg onload="alert(1)"><polyline points="0,0 1,1"/><a href="javascript:alert(1)">bad</a><foreignObject><iframe src="x"></iframe></foreignObject></svg>');
  assert.equal(result.querySelector('script, iframe, foreignObject, [onload], [onerror], [href]'), null);
  assert.ok(result.querySelector('polyline'));
});

test('replaces previous markup when the draft changes', () => {
  const result = render('<p>Old question</p>');
  renderRichContent(result, 'New question');
  assert.equal(result.querySelector('p'), null);
  assert.equal(result.textContent, 'New question');
});

test('renders typed exponents, subscripts and fractions in prose and HTML', () => {
  for (const content of [
    'Differentiate x^2 + 3x. Compare x_1 and x_{n+1}.',
    '<p>Differentiate <strong>x^{12}</strong>, then evaluate \\frac{x^2}{2}.</p>',
    'Simplify (x + 1)^{-2} and sin(x)^2.',
  ]) {
    const result = render(content);
    assert.equal(result.querySelectorAll('.katex').length, content.startsWith('Differentiate') ? 3 : 2);
    assert.equal(result.querySelector('.katex-error'), null);
  }
  assert.ok(render('x^2').querySelector('math msup'));
  assert.ok(render('x_1').querySelector('math msub'));
  assert.ok(render('\\frac{x^2}{2}').querySelector('math mfrac'));
});

test('supports inline and display LaTeX delimiters', () => {
  for (const content of ['\\(x^2\\)', '$x^2$', '\\[\\frac{1}{x}\\]', '$$\\int x^{2}\\,dx$$']) {
    const result = render(content);
    assert.equal(result.querySelectorAll('.katex').length, 1);
    assert.equal(result.querySelectorAll('.katex-display').length, content.startsWith('\\[') || content.startsWith('$$') ? 1 : 0);
  }
});

test('preserves currency, identifiers, addresses and ordinary prose', () => {
  const content = 'Pay $5 and $10. Read chapter_2 and question_id.\nVisit https://example.com/x_1 or a_b@example.com. Is x < 3?';
  const result = render(content);
  assert.equal(result.textContent, content);
  assert.equal(result.querySelector('.katex'), null);
});

test('does not interpret tightly spaced inequalities as HTML tags', () => {
  const result = render('Is x^2<y and z>1?');
  assert.equal(result.querySelector('.math-inline').dataset.latex, 'x^{2}<y');
  assert.ok(result.textContent.includes('and z>1?'));
});

test('leaves code, links, graph labels and existing math alone', () => {
  const result = render('<code>x^2</code><pre>x_1</pre><a href="/x_1">x^2</a><svg><text>x^2</text></svg><span class="math-inline" data-latex="x^2"></span>');
  assert.equal(result.querySelectorAll('.katex').length, 1);
  for (const selector of ['code', 'a', 'svg text']) assert.equal(result.querySelector(selector).textContent, 'x^2');
  assert.equal(result.querySelector('pre').textContent, 'x_1');
});

test('malformed math stays readable and untrusted commands cannot add executable markup', () => {
  for (const content of ['\\(\\frac{x}{\\)', 'x^{', '<span class="math-inline" data-latex="\\frac{x}{"></span>']) {
    const result = render(content);
    assert.equal(result.querySelector('.katex-error, .katex'), null);
    assert.ok(result.textContent.includes('\\frac{x}{') || result.textContent === 'x^{');
  }
  const result = render('\\(\\href{javascript:alert(1)}{x}\\)');
  assert.equal(result.querySelector('a, script, iframe, [onclick]'), null);
});

test('CSV imports render both notation styles without changing stored answers', () => {
  const rows = [
    {'Question Text': 'Differentiate x^2.', 'Question Type': 'multiple_choice', Answer1: '2x', Answer2: 'x^2', Timer: '60'},
    {'Question Text': '<p>Evaluate \\(\\int x\\,dx\\).</p>', 'Question Type': 'multiple_choice',
      Answer1: '<span class="math-inline" data-latex="\\frac{x^2}{2}+C"></span>', Answer2: 'x^2+C', Timer: '90'},
  ];
  const original = structuredClone(rows);
  const questions = questionsFromCsvRows(rows);
  assert.equal(questions.length, 2);
  for (const question of questions) {
    assert.ok(render(question.question).querySelector('.katex'));
    assert.equal(question.correctAnswer, question.options[0]);
  }
  assert.ok(render(questions[1].correctAnswer).querySelector('math mfrac'));
  assert.deepEqual(rows, original);
});

test('math tokenization preserves every original character', () => {
  for (const text of ['Find x^2 and x_1.', 'Pay $5 and $10.', 'Use \\(\\frac{1}{x}\\).', '\\frac{x^2}{2}', 'x^{', 'hello_world x^2']) {
    assert.equal(splitMathText(text).map(part => part.text).join(''), text);
  }
});

test('bare numeric and parenthesized scripts keep the entire exponent or index', () => {
  for (const [source, expected] of [['x^12', 'x^{12}'], ['x^-2', 'x^{-2}'], ['a_12', 'a_{12}'], ['x^(n+1)', 'x^{n+1}']]) {
    const result = render(source);
    assert.equal(result.querySelector('.math-inline').dataset.latex, expected);
    assert.ok(result.querySelector('math msup, math msub'));
  }
});
