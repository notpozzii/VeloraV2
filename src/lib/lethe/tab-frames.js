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
		get(id) {
			if (!entries.has(id)) {
				const entry = {};
				entries.set(id, entry);
				entry.promise = (async () => {
					const controller = await getController();
					if (entries.get(id) !== entry) throw new DOMException('Tab closed', 'AbortError');
					entry.frame = controller.createFrame();
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
