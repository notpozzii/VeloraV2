import { PANIC_SETTING, normalizePanicPreferences, matchesPanicKey } from './panic-preferences.js';

const controllerKey = '__veloraPanicController';

export function panicOwner(host) {
	let owner = host;
	try {
		while (owner.parent && owner.parent !== owner) {
			void owner.parent.document;
			owner = owner.parent;
		}
	} catch {}
	return owner;
}

// One listener tree covers accessible app frames, including frames added later.
export function installPanicController({ host, read, subscribe }) {
	const owner = panicOwner(host);
	if (owner[controllerKey]) return owner[controllerKey].retain();
	let preferences = normalizePanicPreferences(null);
	let alive = true;
	let revision = 0;
	let refs = 0;
	let navigating = false;
	const documents = new Map();
	const frames = new Map();
	const update = value => { revision += 1; preferences = normalizePanicPreferences(value); };
	const stopSettings = subscribe(PANIC_SETTING, update);
	const initialRevision = revision;
	Promise.resolve(read(PANIC_SETTING, null)).then(value => {
		if (alive && revision === initialRevision) preferences = normalizePanicPreferences(value);
	}).catch(() => {});

	function keydown(event) {
		if (navigating || !matchesPanicKey(event, preferences)) return;
		event.preventDefault();
		event.stopImmediatePropagation();
		navigating = true;
		// Our optional close-confirmation must not interrupt the panic action.
		for (const { win } of documents.values()) {
			if (win.__galaxyAntiClose) {
				win.removeEventListener('beforeunload', win.__galaxyAntiClose);
				win.__galaxyAntiClose = null;
			}
		}
		try { owner.location.replace(preferences.url); }
		catch { navigating = false; }
	}
	function containsFrame(node) {
		return node?.nodeType === 1 && (node.matches?.('iframe,frame') || node.querySelector?.('iframe,frame'));
	}
	function refresh() {
		if (!alive) return;
		const seenDocuments = new Set();
		const seenFrames = new Set();
		function visit(win) {
			let doc;
			try { doc = win.document; if (!doc || seenDocuments.has(doc)) return; }
			catch { return; }
			seenDocuments.add(doc);
			if (!documents.has(doc)) {
				doc.addEventListener('keydown', keydown, true);
				const Observer = win.MutationObserver || owner.MutationObserver;
				const observer = Observer ? new Observer(changes => {
					if (changes.some(change => [...change.addedNodes, ...change.removedNodes].some(containsFrame))) refresh();
				}) : null;
				observer?.observe(doc, { childList: true, subtree: true });
				documents.set(doc, { win, observer });
			}
			for (const frame of doc.querySelectorAll('iframe,frame')) {
				seenFrames.add(frame);
				if (!frames.has(frame)) { frame.addEventListener('load', refresh); frames.set(frame, true); }
				try { if (frame.contentWindow) visit(frame.contentWindow); } catch {}
			}
		}
		visit(owner);
		for (const [doc, { observer }] of documents) {
			if (seenDocuments.has(doc)) continue;
			doc.removeEventListener('keydown', keydown, true); observer?.disconnect(); documents.delete(doc);
		}
		for (const frame of frames.keys()) {
			if (seenFrames.has(frame)) continue;
			frame.removeEventListener('load', refresh); frames.delete(frame);
		}
	}
	function dispose() {
		alive = false;
		stopSettings();
		for (const [doc, { observer }] of documents) { doc.removeEventListener('keydown', keydown, true); observer?.disconnect(); }
		for (const frame of frames.keys()) frame.removeEventListener('load', refresh);
		documents.clear(); frames.clear();
		delete owner[controllerKey];
	}
	owner[controllerKey] = {
		retain() {
			refs += 1;
			let released = false;
			return () => { if (!released) { released = true; refs -= 1; if (!refs) dispose(); } };
		}
	};
	refresh();
	return owner[controllerKey].retain();
}
