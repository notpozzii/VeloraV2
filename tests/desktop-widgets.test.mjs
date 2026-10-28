import test from 'node:test';
import assert from 'node:assert/strict';
import { widgetCatalog, widgetData, widgetLimit, fitWidget, transformWidget, placeWidget, readWidgetBoard, focusRemaining, stopwatchElapsed, formatDuration, calculate, calendarMonth } from '../src/lib/utils/os/widgets.js';

const bounds = { width: 1280, height: 760 };
const note = { id: 'note', type: 'notes', x: 100, y: 100, width: 300, height: 250, data: { text: 'Keep this note' } };

test('ten distinct widgets are optional; an empty saved board stays empty', () => {
	assert.equal(widgetCatalog.length, 10);
	assert.equal(new Set(widgetCatalog.map(x => x.type)).size, 10);
	assert.deepEqual(readWidgetBoard(null, bounds), { widgets: [], removed: null });
});

test('dragging and keyboard nudges clamp to the desktop while preserving widget content', () => {
	const moved = transformWidget(note, 'move', 9000, -9000, bounds);
	assert.equal(moved.x, 980); assert.equal(moved.y, 0);
	assert.equal(moved.data, note.data);
	const nudged = transformWidget(note, 'move', 4, 24, bounds);
	assert.equal(nudged.x, 104); assert.equal(nudged.y, 124);
});

test('resizing stays anchored and cannot push the widget outside the desktop', () => {
	const resized = transformWidget(note, 'resize', 9000, 9000, bounds);
	assert.equal(resized.x, note.x); assert.equal(resized.y, note.y);
	assert.equal(resized.x + resized.width, bounds.width);
	assert.equal(resized.y + resized.height, bounds.height);
	const small = transformWidget(note, 'resize', -9000, -9000, bounds);
	assert.equal(small.width, 220); assert.equal(small.height, 180);
});

test('small screens keep headers and resize handles inside the visible workspace', () => {
	const screen = { width: 200, height: 150 };
	const widget = fitWidget({ ...note, x: 900, y: 900 }, screen);
	assert.deepEqual([widget.x, widget.y, widget.width, widget.height], [0, 0, 200, 150]);
});

test('new widgets use free desktop space and drop coordinates are clamped', () => {
	const first = placeWidget('clock', [], bounds);
	const second = placeWidget('clock', [first], bounds);
	assert.ok(first.x >= second.x + second.width || second.x >= first.x + first.width || first.y >= second.y + second.height || second.y >= first.y + first.height);
	const dropped = placeWidget('notes', [], bounds, { x: -900, y: 9000 });
	assert.equal(dropped.x, 0); assert.equal(dropped.y + dropped.height, bounds.height);
});

test('saved positions, notes and a removed widget survive a JSON round-trip for Undo', () => {
	const removed = { ...note, id: 'removed', data: { text: 'Recover me' } };
	const saved = readWidgetBoard(JSON.parse(JSON.stringify({ widgets: [note], removed })), bounds);
	assert.deepEqual(saved.widgets[0], note);
	assert.equal(saved.removed.data.text, 'Recover me');
	assert.equal(saved.removed.id, 'removed');
});

test('corrupt layouts discard unknown types and duplicate IDs, cap counts, and normalize data', () => {
	const saved = readWidgetBoard({ widgets: [note, note, { ...note, type: 'script' }, { ...note, id: 'bad', x: Infinity, width: NaN, data: { text: 'a'.repeat(20000) } }] }, bounds);
	assert.equal(saved.widgets.length, 2);
	assert.equal(saved.widgets[1].x, 0);
	assert.equal(saved.widgets[1].data.text.length, 10000);
	assert.equal(readWidgetBoard({ widgets: Array.from({ length: 50 }, (_, i) => ({ ...note, id: String(i) })) }, bounds).widgets.length, widgetLimit);
	assert.deepEqual(widgetData('checklist', { items: [{ id: 'same', text: 'One' }, { id: 'same', text: 'Two' }] }).items.map(x => x.text), ['One']);
	assert.equal(widgetData('world', { zone: 'Invalid/Zone' }).zone, 'Asia/Tokyo');
});

test('deadline timers and stopwatches account for elapsed time after backgrounding or reloading', () => {
	const timer = { minutes: 25, remaining: 1500, deadline: 1000000 };
	assert.equal(focusRemaining(timer, 940000), 60);
	assert.equal(focusRemaining(timer, 1100000), 0);
	assert.equal(focusRemaining({ ...timer, deadline: null, remaining: 44 }, 1100000), 44);
	assert.equal(stopwatchElapsed({ elapsed: 4000, since: 1000000 }, 1010000), 14000);
	assert.equal(stopwatchElapsed({ elapsed: 4000, since: null }, 1010000), 4000);
	assert.equal(formatDuration(3661), '01:01:01');
});

test('calendar includes leap days, Monday-first alignment, and the current day', () => {
	const calendar = calendarMonth(new Date(2024, 1, 15, 12).getTime(), 0);
	assert.equal(calendar.cells.filter(Boolean).length, 29);
	assert.deepEqual(calendar.cells.slice(0, 3), [null, null, null]);
	assert.equal(calendar.cells.find(x => x?.today).day, 15);
	assert.equal(calendarMonth(new Date(2024, 1, 15, 12).getTime(), 1).cells.some(x => x?.today), false);
});

test('calculator parses arithmetic with precedence, unary signs, decimals and scientific notation', () => {
	for (const [expression, result] of [['2+3*4', '14'], ['(2+3)*4', '20'], ['-2 * -(3 + 4)', '14'], ['.5 + .25', '.75'], ['0.1+0.2', '0.3'], ['1e-3 * 2', '0.002'], ['8÷2×3−1', '11']]) assert.equal(Number(calculate(expression)), Number(result));
});

test('calculator rejects executable input, malformed expressions, overflow and division by zero', () => {
	for (const input of ['globalThis.alert(1)', '1;2', '2 ** 4', '2(3)', '1/0', '1e308*2', '()', '1+']) assert.throws(() => calculate(input));
	assert.throws(() => calculate('('.repeat(40) + '1' + ')'.repeat(40)));
});
