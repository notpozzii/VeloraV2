export function createTabFrames(getController) {
	const entries = new Map();
	function release(id) {
		const entry = entries.get(id);
		entries.delete(id);
		if (entry?.frame) {
			const frames = entry.frame.controller.frames;
			const index = frames.indexOf(entry.frame);
			if (index !== -1) frames.splice(index, 1);
		}
	}
	return {
		get(id, controller) {
			if (entries.has(id) && entries.get(id).controller !== controller) release(id);
			if (!entries.has(id)) {
				const entry = { controller };
				entries.set(id, entry);
				entry.promise = (async () => {
					const selected = controller ?? await getController();
					if (entries.get(id) !== entry) throw new DOMException('Tab closed', 'AbortError');
					entry.frame = selected.createFrame();
					return entry.frame;
				})().catch(error => {
					if (entries.get(id) === entry) entries.delete(id);
					throw error;
				});
			}
			return entries.get(id).promise;
		},
		release,
		clear() { for (const id of entries.keys()) release(id); }
	};
}
