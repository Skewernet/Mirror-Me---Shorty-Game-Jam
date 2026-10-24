// Validate the text renderer in a real DOM: dialogue is plain text even when
// it contains markup, and its formatting can be called every animation frame.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.MIRROR_TEST_URL || 'http://127.0.0.1:8000';

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => sessionStorage.setItem('mirror-me.intro.v1', 'acknowledged'));
    await page.route('**/src/main.mjs', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
    await page.goto(base + '/');
    const result = await page.evaluate(async () => {
      const { renderHorrorText, decorateHorrorText } = await import('/src/ui-text.mjs');
      const element = document.createElement('div'); document.body.append(element);
      const story = 'Mum said, “The DEAD do not die twice.” <img src=x onerror="window.unsafe=true"> Blood, died, death. Mother. Summer.';
      renderHorrorText(element, story);
      const exact = element.textContent === story;
      const words = [...element.querySelectorAll('.horror-word')].map(word => word.textContent);
      const initialNode = element.firstChild;
      renderHorrorText(element, story);
      const cached = initialNode === element.firstChild;
      const injectionSafe = !window.unsafe && !element.querySelector('img');
      element.textContent = '';
      renderHorrorText(element, story);
      const restored = element.textContent === story && element.querySelectorAll('.horror-word').length === words.length;
      const red = getComputedStyle(element.querySelector('.horror-word'));
      const style = { color: red.color, outline: red.textShadow };
      renderHorrorText(element, null);
      const cleared = element.textContent === '' && !element.childNodes.length;

      const journal = document.createElement('article');
      journal.innerHTML = '<p>Mum<br>is <a href="#journal">dead</a>, she wrote.</p><kbd>DEAD</kbd><span aria-hidden="true">Mum</span>';
      const originalText = journal.textContent, link = journal.querySelector('a'), br = journal.querySelector('br');
      const decorated = decorateHorrorText(journal);
      const sameMarkup = link === journal.querySelector('a') && br === journal.querySelector('br') && link.getAttribute('href') === '#journal';
      const idempotent = decorateHorrorText(journal) === 0 && journal.querySelectorAll('.horror-word').length === decorated;
      return { exact, words, cached, injectionSafe, restored, style, cleared, decorated, sameMarkup,
        sameJournalText: journal.textContent === originalText, idempotent,
        skippedKeys: !journal.querySelector('kbd .horror-word') && !journal.querySelector('[aria-hidden] .horror-word') };
    });
    for (const name of ['exact', 'cached', 'injectionSafe', 'restored', 'cleared', 'sameMarkup', 'sameJournalText', 'idempotent', 'skippedKeys'])
      assert.equal(result[name], true, name);
    assert.deepEqual(result.words, ['Mum', 'DEAD', 'Blood', 'died', 'death', 'Mother']);
    assert.equal(result.decorated, 2);
    assert.equal(result.style.color, 'rgb(237, 65, 65)');
    assert.notEqual(result.style.outline, 'none');
    console.log(JSON.stringify({ result: 'PASS', checks: ['literal untrusted dialogue', 'exact textContent', 'case-aware whole words',
      'unchanged-frame DOM cache', 'restore after direct text reset', 'red words with black outline', 'journal links/line breaks retained', 'idempotent decoration'] }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
