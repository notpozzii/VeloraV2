// Adapt this SVG document for the embedded HTML desktop. This creates no
// browsing context and never loads a hosted desktop document.
(() => {
  const htmlNamespace = 'http://www.w3.org/1999/xhtml';
  const body = document.getElementById('velora-svg-body');
  const head = document.getElementById('velora-svg-head');
  if (!body || !head) throw new Error('The SVG desktop containers are missing');

  // SVG documents normally have no document.body or document.head. Give the
  // desktop its actual XHTML containers without replacing the SVG root.
  Object.defineProperties(document, {
    body: { configurable: true, get: () => body },
    head: { configurable: true, get: () => head }
  });

  const createElementNS = document.createElementNS.bind(document);
  // Svelte builds its fragments with HTML templates. Parse them in an inert
  // HTML document so HTML parsing rules also work inside an XML/SVG document.
  // Their nodes are adopted into this SVG document when the desktop mounts.
  const templates = document.implementation.createHTMLDocument('');
  Object.defineProperty(document, 'createElement', {
    configurable: true,
    value(name, options) {
      const tag = String(name).toLowerCase();
      return tag === 'template'
        ? templates.createElement(tag, options)
        : createElementNS(htmlNamespace, tag, options);
    }
  });
})();
