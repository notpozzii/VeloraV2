export function createDockResize({ host, getSize, setSize, onDragging, onCommit }) {
	let active = false;
	let startY = 0;
	let startSize = 0;
	function move(event) {
		if (!active || !Number.isFinite(event.clientY)) return;
		setSize(Math.max(8, Math.min(39, startSize - (event.clientY - startY) * 0.2)));
	}
	function stop() {
		if (!active) return;
		active = false;
		host.removeEventListener('mousemove', move);
		host.removeEventListener('mouseup', stop);
		host.removeEventListener('blur', stop);
		onDragging(false);
		onCommit();
	}
	function start(event) {
		if (event.button !== 0 || !Number.isFinite(event.clientY)) return;
		stop();
		event.preventDefault();
		startY = event.clientY;
		startSize = getSize();
		active = true;
		onDragging(true);
		// A normal drag also works when pointer lock is unavailable or denied.
		host.addEventListener('mousemove', move);
		host.addEventListener('mouseup', stop);
		host.addEventListener('blur', stop);
	}
	return { start, stop };
}
