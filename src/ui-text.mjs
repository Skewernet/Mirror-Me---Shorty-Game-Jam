// Build text with real text nodes. Story/dialogue strings are never parsed as
// markup, and textContent remains byte-for-byte identical for accessibility.
const triggerWords = /\b(?:mum|mom|mother|dead|died|death|blood|killed|kill|killing|murder|murdered)\b/gi;

export function renderHorrorText(element, text) {
  if (!element) return;
  const value = String(text ?? "");
  if (element.dataset.horrorText === value && element.textContent === value) return;
  const document = element.ownerDocument;
  const fragment = document.createDocumentFragment();
  let previous = 0;
  triggerWords.lastIndex = 0;
  for (const match of value.matchAll(triggerWords)) {
    if (match.index > previous) fragment.append(document.createTextNode(value.slice(previous, match.index)));
    const span = document.createElement("span");
    span.className = "horror-word";
    span.textContent = match[0];
    fragment.append(span);
    previous = match.index + match[0].length;
  }
  if (previous < value.length) fragment.append(document.createTextNode(value.slice(previous)));
  element.replaceChildren(fragment);
  element.dataset.horrorText = value;
}

// Existing journal/credits markup has useful line breaks and source links.
// Decorate only its text leaves instead of flattening or reparsing that markup.
export function decorateHorrorText(root) {
  if (!root) return 0;
  const document = root.ownerDocument || root;
  const NodeFilter = document.defaultView.NodeFilter;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const leaves = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest('.horror-word, script, style, textarea, input, select, option, kbd, [aria-hidden="true"]')) continue;
    triggerWords.lastIndex = 0;
    if (triggerWords.test(node.data)) leaves.push(node);
  }
  let count = 0;
  for (const node of leaves) {
    const fragment = document.createDocumentFragment();
    let previous = 0;
    triggerWords.lastIndex = 0;
    for (const match of node.data.matchAll(triggerWords)) {
      if (match.index > previous) fragment.append(document.createTextNode(node.data.slice(previous, match.index)));
      const span = document.createElement('span');
      span.className = 'horror-word'; span.textContent = match[0];
      fragment.append(span); previous = match.index + match[0].length; count++;
    }
    if (previous < node.data.length) fragment.append(document.createTextNode(node.data.slice(previous)));
    node.replaceWith(fragment);
  }
  return count;
}
