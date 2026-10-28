<script>
	import { onMount, tick } from 'svelte';
	import Icon from '$lib/utils/browser/icon.svelte';
	import WidgetContent from './widget-content.svelte';
	import { widgetCatalog, widgetStorageKey, widgetLimit, widgetDefinition, widgetData, readWidgetBoard, placeWidget, fitWidget, transformWidget } from './widgets.js';
	let { apps = [], windows = [], ready = true, onlaunch, onfocus } = $props();
	let board;
	let widgets = $state([]);
	let removed = $state(null);
	let loaded = $state(false);
	let pickerOpen = $state(false);
	let catalogDrag = $state('');
	let movingId = $state(null);
	let activeId = $state(null);
	let dismissed = $state(true);
	let notice = $state('');
	let storageError = $state('');
	let now = $state(Date.now());
	let bounds = { width: 1000, height: 600 };
	let saveTimer;
	let gesture;
	let previousFocus;
	const mime = 'application/x-velora-widget';

	function flushSave() {
		clearTimeout(saveTimer);
		if (!loaded) return;
		try {
			localStorage.setItem(widgetStorageKey, JSON.stringify({ version: 1, widgets: $state.snapshot(widgets), removed: $state.snapshot(removed) }));
			storageError = '';
		} catch { storageError = 'This browser could not save your widget changes.'; }
	}
	function save() { clearTimeout(saveTimer); saveTimer = setTimeout(flushSave, 180); }
	function measure() {
		const rect = board?.getBoundingClientRect();
		if (!rect?.width || !rect.height) return;
		bounds = { width: rect.width, height: rect.height };
		widgets = widgets.map(widget => fitWidget(widget, bounds));
	}
	onMount(() => {
		measure();
		try {
			const saved = readWidgetBoard(JSON.parse(localStorage.getItem(widgetStorageKey) || '{}'), bounds);
			widgets = saved.widgets; removed = saved.removed;
		} catch {}
		loaded = true;
		const observer = new ResizeObserver(measure);
		observer.observe(board);
		const timer = setInterval(() => { if (widgets.some(w => ['clock', 'world', 'calendar', 'focus', 'stopwatch'].includes(w.type))) now = Date.now(); }, 1000);
		const visibility = () => { if (document.hidden) flushSave(); else now = Date.now(); };
		window.addEventListener('beforeunload', flushSave);
		document.addEventListener('visibilitychange', visibility);
		return () => {
			flushSave(); clearInterval(timer); observer.disconnect();
			window.removeEventListener('beforeunload', flushSave);
			document.removeEventListener('visibilitychange', visibility);
		};
	});

	export async function showPicker() {
		previousFocus = document.activeElement;
		pickerOpen = true;
		await tick();
		document.getElementById('widget-picker-close')?.focus();
	}
	export function togglePicker(event) {
		event?.stopPropagation();
		if (pickerOpen) closePicker(); else void showPicker();
	}
	function closePicker() {
		pickerOpen = false; catalogDrag = '';
		if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
	}
	function addWidget(type, point) {
		if (!loaded || !widgetDefinition(type)) return;
		if (widgets.length >= widgetLimit) { notice = 'You can add up to 30 widgets.'; return; }
		measure(); now = Date.now();
		const { x, y, width, height } = placeWidget(type, widgets, bounds, point);
		const widget = { id: crypto.randomUUID(), type, x, y, width, height, data: widgetData(type) };
		widgets = [...widgets, widget]; activeId = widget.id;
		notice = `${widgetDefinition(type).name} added.`; save();
	}
	function removeWidget(id) {
		const widget = widgets.find(entry => entry.id === id);
		if (!widget) return;
		removed = { ...widget }; widgets = widgets.filter(entry => entry.id !== id);
		dismissed = false; notice = `${widgetDefinition(widget.type).name} removed. Undo is available.`; save();
	}
	function restoreWidget() {
		if (!removed || widgets.length >= widgetLimit) return;
		widgets = [...widgets, fitWidget(removed, bounds)]; activeId = removed.id;
		removed = null; dismissed = true; notice = 'Widget restored.'; save();
	}
	function updateData(id, data) {
		widgets = widgets.map(widget => widget.id === id ? { ...widget, data: widgetData(widget.type, data) } : widget);
		save();
	}
	function startGesture(event, widget, mode) {
		if (event.button !== 0 || gesture) return;
		event.preventDefault(); event.stopPropagation();
		activeId = widget.id; movingId = widget.id;
		gesture = { id: widget.id, mode, pointer: event.pointerId, target: event.currentTarget, startX: event.clientX, startY: event.clientY, x: widget.x, y: widget.y, width: widget.width, height: widget.height };
		try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
	}
	function moveGesture(event) {
		if (!gesture || gesture.pointer !== event.pointerId) return;
		const dx = event.clientX - gesture.startX; const dy = event.clientY - gesture.startY;
		widgets = widgets.map(widget => widget.id !== gesture.id ? widget : transformWidget({ ...widget, x: gesture.x, y: gesture.y, width: gesture.width, height: gesture.height }, gesture.mode, dx, dy, bounds));
	}
	function finishGesture(event, cancel = false) {
		if (!gesture || (event?.pointerId !== undefined && gesture.pointer !== event.pointerId)) return;
		const ended = gesture; gesture = null; movingId = null;
		if (cancel) widgets = widgets.map(widget => widget.id === ended.id ? fitWidget({ ...widget, x: ended.x, y: ended.y, width: ended.width, height: ended.height }, bounds) : widget);
		try { ended.target.releasePointerCapture(ended.pointer); } catch {}
		if (!cancel) { notice = ended.mode === 'move' ? 'Widget moved.' : 'Widget resized.'; save(); }
	}
	function keyboardPosition(event, widget, mode) {
		if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
		event.preventDefault(); event.stopPropagation();
		const step = event.shiftKey ? 24 : 4;
		const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
		const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
		widgets = widgets.map(entry => entry.id !== widget.id ? entry : transformWidget(entry, mode, dx, dy, bounds));
		activeId = widget.id; save();
	}
	function dropWidget(event) {
		const type = event.dataTransfer?.getData(mime);
		if (!widgetDefinition(type)) return;
		event.preventDefault();
		const rect = board.getBoundingClientRect();
		addWidget(type, { x: event.clientX - rect.left, y: event.clientY - rect.top });
		catalogDrag = ''; pickerOpen = false;
	}
</script>

<svelte:window onkeydown={event => { if (event.key === 'Escape') { if (gesture) finishGesture(undefined, true); if (pickerOpen) closePicker(); } }} onpointerdown={event => { if (pickerOpen && !event.target.closest('[data-widget-picker], [data-widget-picker-toggle]') && !catalogDrag) pickerOpen = false; }} />

<div class="widget-board" class:accepting-drop={!!catalogDrag} class:moving={!!movingId} bind:this={board}
	role="region" aria-label="Desktop widgets"
	ondragover={event => { if (Array.from(event.dataTransfer?.types || []).includes(mime)) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } }} ondrop={dropWidget}>
	<p class="sr-only" id="widget-move-help">Drag the title to move this widget. When the title or resize handle has focus, use arrow keys to move or resize. Hold Shift for larger steps.</p>
	{#if catalogDrag}<div class="widget-drop-hint">Drop {widgetDefinition(catalogDrag)?.name} anywhere</div>{/if}
	{#each widgets as widget, index (widget.id)}
		<section class="desktop-widget" class:is-moving={movingId === widget.id} aria-label={`${widgetDefinition(widget.type).name} widget`}
			style:left={`${widget.x}px`} style:top={`${widget.y}px`} style:width={`${widget.width}px`} style:height={`${widget.height}px`} style:z-index={activeId === widget.id ? 100 : index + 1}>
			<div class="widget-header">
				<button class="widget-drag-handle" aria-label={`Move ${widgetDefinition(widget.type).name} widget`} aria-describedby="widget-move-help" title="Drag to move · arrow keys also work"
					onpointerdown={event => startGesture(event, widget, 'move')} onpointermove={moveGesture} onpointerup={finishGesture} onpointercancel={event => finishGesture(event, true)} onlostpointercapture={finishGesture} onkeydown={event => keyboardPosition(event, widget, 'move')}>
					<Icon name={widgetDefinition(widget.type).icon} size={14} /><span>{widgetDefinition(widget.type).name}</span><span class="widget-grip" aria-hidden="true">⠿</span>
				</button>
				<button class="widget-remove" aria-label={`Remove ${widgetDefinition(widget.type).name} widget`} onclick={() => removeWidget(widget.id)}><Icon name="close" size={13} /></button>
			</div>
			<div class="widget-body"><WidgetContent {widget} {now} {apps} {windows} {ready} onupdate={data => updateData(widget.id, data)} {onlaunch} {onfocus} /></div>
			<button class="widget-resize" aria-label={`Resize ${widgetDefinition(widget.type).name} widget`} aria-describedby="widget-move-help" title="Drag to resize · arrow keys also work"
				onpointerdown={event => startGesture(event, widget, 'resize')} onpointermove={moveGesture} onpointerup={finishGesture} onpointercancel={event => finishGesture(event, true)} onlostpointercapture={finishGesture} onkeydown={event => keyboardPosition(event, widget, 'resize')}><Icon name="resize" size={13} /></button>
		</section>
	{/each}
</div>

{#if pickerOpen}
	<dialog open class="widget-picker" class:catalog-dragging={!!catalogDrag} aria-label="Widget picker" data-widget-picker>
		<div class="widget-picker-heading"><div><h2>Widgets</h2><p>Drag onto your desktop, or choose Add.</p></div><button id="widget-picker-close" class="menubar-icon" aria-label="Close widget picker" onclick={closePicker}><Icon name="close" size={18} /></button></div>
		<div class="widget-catalog">{#each widgetCatalog as entry}<article draggable={loaded && widgets.length < widgetLimit} ondragstart={event => { event.dataTransfer.setData(mime, entry.type); event.dataTransfer.effectAllowed = 'copy'; catalogDrag = entry.type; }} ondragend={() => (catalogDrag = '')}>
			<span class="catalog-icon"><Icon name={entry.icon} size={23} /></span><div><h3>{entry.name}</h3><p>{entry.description}</p></div><button aria-label={`Add ${entry.name} widget`} disabled={!loaded || widgets.length >= widgetLimit} onclick={() => addWidget(entry.type)}><Icon name="plus" size={16} /></button>
		</article>{/each}</div>
		<div class="widget-picker-footer"><span>{widgets.length} / {widgetLimit} added · Saved on this browser</span>{#if removed}<button onclick={restoreWidget} disabled={widgets.length >= widgetLimit}>Restore last removed</button>{/if}</div>
	</dialog>
{/if}

{#if removed && !dismissed}<div class="widget-undo"><span>Widget removed</span><button onclick={restoreWidget}>Undo</button><button aria-label="Dismiss widget message" onclick={() => (dismissed = true)}><Icon name="close" size={13} /></button></div>{/if}
{#if storageError}<div class="widget-save-error" role="alert">{storageError}</div>{/if}
<div class="sr-only" role="status">{notice}</div>

<style>
	.widget-board { position: absolute; inset: 84px 12px calc(var(--dock-height) + 36px); pointer-events: none; z-index: 0; isolation: isolate; }
	.widget-board.moving { user-select: none; }
	.widget-board.accepting-drop { pointer-events: auto; border: 1px dashed #d3e5b060; border-radius: 18px; background-image: radial-gradient(#d3e5b02a 1px, transparent 1px); background-size: 20px 20px; }
	.widget-drop-hint { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); padding: 8px 13px; color: #e0edce; background: #15261ee8; border: 1px solid #d3e5b02a; border-radius: 9px; font-size: 11px; white-space: nowrap; }
	.desktop-widget { position: absolute; pointer-events: auto; border-radius: 17px; display: flex; flex-direction: column; min-width: 0; min-height: 0; color: var(--os-text); }
	.desktop-widget.is-moving { outline: 1px solid #d3e5b06b; box-shadow: 0 20px 55px #06140b5c; }
	.widget-header { display: flex; align-items: center; gap: 3px; flex: 0 0 36px; padding: 0 8px 0 13px; border-bottom: 1px solid #ffffff0b; }
	.widget-drag-handle { display: flex; flex: 1; min-width: 0; align-items: center; gap: 8px; height: 100%; border: 0; background: transparent; padding: 0; text-align: left; cursor: grab; touch-action: none; }
	.widget-drag-handle:active { cursor: grabbing; }
	.widget-drag-handle > span:not(.widget-grip) { font-size: 10px; font-weight: 500; }
	.widget-drag-handle :global(svg) { color: var(--os-accent); opacity: .85; }
	.widget-grip { margin-left: auto; opacity: .35; font-size: 17px; padding-right: 4px; }
	.widget-remove { width: 22px; height: 23px; display: grid; place-items: center; background: transparent; border: 0; border-radius: 6px; opacity: .65; padding: 0; }
	.widget-remove:hover { background: #ffffff16; opacity: 1; }
	.widget-body { flex: 1; min-height: 0; padding: 14px 16px 17px; overflow: auto; border-radius: 0 0 17px 17px; scrollbar-width: thin; scrollbar-color: #a9bf9255 transparent; }
	.widget-resize { display: grid; place-items: center; width: 21px; height: 21px; position: absolute; bottom: 2px; right: 2px; border: 0; border-radius: 6px; background: transparent; opacity: .35; padding: 0; cursor: nwse-resize; touch-action: none; }
	.widget-resize:hover, .widget-resize:focus-visible { opacity: 1; background: #ffffff0b; }
	.widget-picker { position: fixed; inset: 82px 22px auto auto; margin: 0; width: min(600px, calc(100vw - 32px)); max-height: calc(100dvh - 112px); overflow: auto; z-index: 10002; padding: 23px; border-radius: 22px; color: var(--os-text); transition: opacity 150ms; }
	.widget-picker.catalog-dragging { opacity: .35; pointer-events: none; }
	.widget-picker-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 21px; }
	.widget-picker-heading h2 { margin: 0; font-size: 23px; font-weight: 500; letter-spacing: -.7px; }
	.widget-picker-heading p { margin: 8px 0 0; color: #bfccb5; font-size: 11px; }
	.widget-catalog { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
	.widget-catalog article { display: flex; align-items: center; gap: 10px; padding: 13px 10px; border-radius: 13px; border: 1px solid #ffffff12; background: #ffffff04; min-width: 0; cursor: grab; }
	.widget-catalog article:hover { background: #ffffff0b; border-color: #d3e5b03b; }
	.catalog-icon { color: var(--os-accent); display: grid; place-items: center; width: 34px; flex-shrink: 0; }
	.widget-catalog article > div { flex: 1; min-width: 0; }
	.widget-catalog h3 { font-size: 11px; font-weight: 550; margin: 0 0 5px; }
	.widget-catalog p { font-size: 9px; line-height: 1.5; color: #b4c2a9; margin: 0; }
	.widget-catalog article > button { width: 25px; height: 27px; display: grid; place-items: center; padding: 0; background: #d3e5b010; border: 1px solid #d3e5b021; border-radius: 7px; flex-shrink: 0; }
	.widget-catalog article > button:hover { background: #d3e5b02c; }
	.widget-picker-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-top: 1px solid #ffffff15; padding-top: 16px; margin-top: 20px; font-size: 9px; color: #bfccb5; }
	.widget-picker-footer button { border: 0; padding: 0; background: transparent; color: var(--os-accent); font-size: 10px; }
	.widget-undo, .widget-save-error { position: absolute; left: 24px; bottom: calc(var(--dock-height) + 36px); z-index: 10003; display: flex; align-items: center; gap: 14px; padding: 12px 14px; border-radius: 11px; border: 1px solid #ffffff20; background: #19261ff5; color: #e8efdf; font-size: 11px; max-width: calc(100% - 48px); }
	.widget-undo button { border: 0; background: transparent; padding: 0; color: var(--os-accent); font-size: 11px; }
	.widget-save-error { bottom: calc(var(--dock-height) + 92px); }
	.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
	@media (max-width: 520px) { .widget-picker { right: 16px; top: 72px; padding: 18px; } .widget-catalog { grid-template-columns: 1fr; } .widget-catalog p { font-size: 10px; } .widget-picker-footer { align-items: flex-start; flex-direction: column; } }
	@media (prefers-reduced-motion: reduce) { .widget-picker { transition: none; } }
</style>
