export const widgetCatalog = [
	{ type: 'clock', name: 'Clock', description: 'Local time, analog and digital', icon: 'clock', width: 232, height: 258, minWidth: 210, minHeight: 230 },
	{ type: 'world', name: 'World clock', description: 'Choose a time zone', icon: 'globe', width: 270, height: 205, minWidth: 230, minHeight: 190 },
	{ type: 'calendar', name: 'Calendar', description: 'Browse months and jump to today', icon: 'calendar', width: 300, height: 320, minWidth: 270, minHeight: 295 },
	{ type: 'focus', name: 'Focus timer', description: '15, 25, or 45 minute sessions', icon: 'focus', width: 270, height: 250, minWidth: 245, minHeight: 230 },
	{ type: 'stopwatch', name: 'Stopwatch', description: 'Time a session and record laps', icon: 'timer', width: 280, height: 240, minWidth: 245, minHeight: 215 },
	{ type: 'notes', name: 'Notes', description: 'A note that saves as you type', icon: 'note', width: 290, height: 270, minWidth: 220, minHeight: 180 },
	{ type: 'checklist', name: 'Checklist', description: 'Keep track of your tasks', icon: 'check', width: 310, height: 300, minWidth: 260, minHeight: 230 },
	{ type: 'calculator', name: 'Calculator', description: 'Quick arithmetic, with keyboard input', icon: 'calculator', width: 270, height: 360, minWidth: 245, minHeight: 325 },
	{ type: 'launch', name: 'Quick launch', description: 'Open your apps from the desktop', icon: 'apps', width: 280, height: 255, minWidth: 250, minHeight: 230 },
	{ type: 'windows', name: 'Open windows', description: 'Switch between running apps', icon: 'desktop', width: 290, height: 250, minWidth: 250, minHeight: 210 }
];

export const widgetStorageKey = 'velora:desktop-widgets:v1';
export const widgetLimit = 30;
const number = (value, fallback) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const text = (value, max) => typeof value === 'string' ? value.slice(0, max) : '';
export const widgetDefinition = type => widgetCatalog.find(entry => entry.type === type);

export function fitWidget(widget, bounds) {
	const definition = widgetDefinition(widget.type);
	const availableWidth = Math.max(1, number(bounds.width, 1));
	const availableHeight = Math.max(1, number(bounds.height, 1));
	const width = clamp(number(widget.width, definition.width), Math.min(definition.minWidth, availableWidth), availableWidth);
	const height = clamp(number(widget.height, definition.height), Math.min(definition.minHeight, availableHeight), availableHeight);
	return { ...widget, width, height, x: clamp(number(widget.x, 0), 0, availableWidth - width), y: clamp(number(widget.y, 0), 0, availableHeight - height) };
}

export function transformWidget(widget, mode, dx, dy, bounds) {
	if (mode === 'resize') return fitWidget({ ...widget, width: Math.min(bounds.width - widget.x, widget.width + dx), height: Math.min(bounds.height - widget.y, widget.height + dy) }, bounds);
	return fitWidget({ ...widget, x: widget.x + dx, y: widget.y + dy }, bounds);
}

export function widgetData(type, input = {}) {
	const data = input && typeof input === 'object' ? input : {};
	if (type === 'notes') return { text: text(data.text, 10000) };
	if (type === 'checklist') {
		const seen = new Set();
		return { items: (Array.isArray(data.items) ? data.items : []).slice(0, 40).flatMap(item => {
			if (!item || typeof item.id !== 'string') return [];
			const id = item.id.slice(0, 80);
			if (!id || seen.has(id)) return [];
			seen.add(id);
			return [{ id, text: text(item.text, 200), done: item.done === true }];
		}) };
	}
	if (type === 'focus') {
		const minutes = [15, 25, 45].includes(data.minutes) ? data.minutes : 25;
		return { minutes, remaining: clamp(number(data.remaining, minutes * 60), 0, minutes * 60), deadline: typeof data.deadline === 'number' && Number.isFinite(data.deadline) ? data.deadline : null };
	}
	if (type === 'stopwatch') return {
		elapsed: Math.max(0, number(data.elapsed, 0)), since: typeof data.since === 'number' && Number.isFinite(data.since) ? data.since : null,
		lapCount: Math.max(0, Math.floor(number(data.lapCount, Array.isArray(data.laps) ? data.laps.length : 0))),
		laps: (Array.isArray(data.laps) ? data.laps : []).filter(x => typeof x === 'number' && Number.isFinite(x) && x >= 0).slice(0, 5)
	};
	if (type === 'world') {
		let zone = text(data.zone, 80) || 'Asia/Tokyo';
		try { new Intl.DateTimeFormat('en', { timeZone: zone }).format(); } catch { zone = 'Asia/Tokyo'; }
		return { zone };
	}
	if (type === 'calendar') return { offset: Math.round(clamp(number(data.offset, 0), -120, 120)) };
	if (type === 'calculator') return { expression: text(data.expression, 160), result: text(data.result, 40) };
	return {};
}

export function readWidgetBoard(value, bounds) {
	const seen = new Set();
	function read(entry) {
		if (!entry || !widgetDefinition(entry.type) || typeof entry.id !== 'string' || entry.id.length > 80 || !entry.id || seen.has(entry.id)) return null;
		seen.add(entry.id);
		return fitWidget({ id: entry.id, type: entry.type, x: entry.x, y: entry.y, width: entry.width, height: entry.height, data: widgetData(entry.type, entry.data) }, bounds);
	}
	const widgets = (Array.isArray(value?.widgets) ? value.widgets : []).slice(0, widgetLimit).map(read).filter(Boolean);
	return { widgets, removed: read(value?.removed) };
}

export function placeWidget(type, widgets, bounds, point) {
	const definition = widgetDefinition(type);
	const draft = fitWidget({ type, width: definition.width, height: definition.height, x: 0, y: 0 }, bounds);
	if (point) return fitWidget({ ...draft, x: point.x - draft.width / 2, y: point.y - 18 }, bounds);
	// Fill the right side first, leaving the existing clock and search visible.
	for (let y = 10; y <= Math.max(10, bounds.height - draft.height); y += 30) {
		for (let x = Math.max(0, bounds.width - draft.width - 14); x >= 0; x -= 30) {
			if (!widgets.some(w => x < w.x + w.width + 12 && x + draft.width + 12 > w.x && y < w.y + w.height + 12 && y + draft.height + 12 > w.y)) return fitWidget({ ...draft, x, y }, bounds);
		}
	}
	return fitWidget({ ...draft, x: bounds.width - draft.width - 14 - widgets.length * 16, y: 10 + widgets.length * 22 }, bounds);
}

export const focusRemaining = (data, now) => data.deadline === null ? data.remaining : clamp(Math.ceil((data.deadline - now) / 1000), 0, data.minutes * 60);
export const stopwatchElapsed = (data, now) => data.elapsed + (data.since === null ? 0 : Math.max(0, now - data.since));
export function formatDuration(seconds) {
	seconds = Math.max(0, Math.floor(seconds));
	const hours = Math.floor(seconds / 3600);
	return `${hours ? `${String(hours).padStart(2, '0')}:` : ''}${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function calendarMonth(now, offset) {
	const today = new Date(now);
	const month = new Date(today.getFullYear(), today.getMonth() + offset, 1);
	const start = (month.getDay() + 6) % 7;
	const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
	return { label: month.toLocaleDateString([], { month: 'long', year: 'numeric' }), cells: Array.from({ length: Math.ceil((start + count) / 7) * 7 }, (_, index) => {
		const day = index - start + 1;
		return day < 1 || day > count ? null : { day, today: offset === 0 && day === today.getDate() };
	}) };
}

// Parse arithmetic only; calculator input is never evaluated as JavaScript.
export function calculate(expression) {
	if (typeof expression !== 'string' || expression.length > 160) throw new Error('Invalid expression');
	const input = expression.replace(/\s/g, '').replaceAll('×', '*').replaceAll('÷', '/').replaceAll('−', '-');
	const tokens = input.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[()+*/-]/gi) || [];
	if (!input || tokens.join('') !== input) throw new Error('Invalid expression');
	let index = 0;
	function atom(depth = 0) {
		if (depth > 32) throw new Error('Expression too deep');
		const token = tokens[index++];
		if (token === '+' || token === '-') return (token === '-' ? -1 : 1) * atom(depth + 1);
		if (token === '(') { const value = sum(depth + 1); if (tokens[index++] !== ')') throw new Error('Missing parenthesis'); return value; }
		if (!token || !/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(token)) throw new Error('Expected a number');
		return Number(token);
	}
	function product(depth) { let value = atom(depth); while (tokens[index] === '*' || tokens[index] === '/') { const op = tokens[index++]; const right = atom(depth); value = op === '*' ? value * right : value / right; } return value; }
	function sum(depth = 0) { let value = product(depth); while (tokens[index] === '+' || tokens[index] === '-') { const op = tokens[index++]; const right = product(depth); value = op === '+' ? value + right : value - right; } return value; }
	const result = sum();
	if (index !== tokens.length || !Number.isFinite(result)) throw new Error('Invalid result');
	return String(Number(result.toPrecision(12)));
}
