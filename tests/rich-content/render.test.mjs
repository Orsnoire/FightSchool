import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { renderRichContent } from '../../client/src/lib/richContent.ts';

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
