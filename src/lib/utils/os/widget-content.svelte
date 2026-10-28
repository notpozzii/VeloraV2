<script>
	import Icon from '$lib/utils/browser/icon.svelte';
	import AppIcon from './app-icon.svelte';
	import { calendarMonth, calculate, focusRemaining, stopwatchElapsed, formatDuration } from './widgets.js';
	let { widget, now, apps = [], windows = [], ready = true, onupdate, onlaunch, onfocus } = $props();
	const data = $derived(widget.data);
	const date = $derived(new Date(now));
	const month = $derived(widget.type === 'calendar' ? calendarMonth(now, data.offset) : null);
	const remaining = $derived(widget.type === 'focus' ? focusRemaining(data, now) : 0);
	const focusing = $derived(widget.type === 'focus' && data.deadline !== null && remaining > 0);
	const elapsed = $derived(widget.type === 'stopwatch' ? stopwatchElapsed(data, now) : 0);
	let task = $state('');
	const zones = [
		['UTC', 'UTC'], ['America/New_York', 'New York'], ['America/Chicago', 'Chicago'],
		['America/Los_Angeles', 'Los Angeles'], ['Europe/London', 'London'], ['Europe/Paris', 'Paris'],
		['Asia/Dubai', 'Dubai'], ['Asia/Kolkata', 'Kolkata'], ['Asia/Tokyo', 'Tokyo'], ['Australia/Sydney', 'Sydney']
	];
	function focusToggle() {
		const left = focusRemaining(data, Date.now());
		onupdate(focusing ? { ...data, remaining: left, deadline: null } : { ...data, remaining: left || data.minutes * 60, deadline: Date.now() + (left || data.minutes * 60) * 1000 });
	}
	function focusReset(minutes = data.minutes) { onupdate({ minutes, remaining: minutes * 60, deadline: null }); }
	function stopwatchToggle() {
		onupdate(data.since === null ? { ...data, since: Date.now() } : { ...data, elapsed: stopwatchElapsed(data, Date.now()), since: null });
	}
	function addTask(event) {
		event.preventDefault();
		if (!task.trim() || data.items.length >= 40) return;
		onupdate({ items: [...data.items, { id: crypto.randomUUID(), text: task.trim().slice(0, 200), done: false }] });
		task = '';
	}
	function solve() {
		try { onupdate({ ...data, result: calculate(data.expression) }); }
		catch { onupdate({ ...data, result: 'Error' }); }
	}
	function calculatorKey(key) {
		if (key === 'AC') return onupdate({ expression: '', result: '' });
		if (key === '=') return solve();
		if (key === '⌫') return onupdate({ expression: data.expression.slice(0, -1), result: '' });
		const symbol = { '×': '*', '÷': '/', '−': '-' }[key] || key;
		let expression = data.expression;
		if (data.result) expression = /^[+*/-]$/.test(symbol) && data.result !== 'Error' ? data.result : '';
		onupdate({ expression: (expression + symbol).slice(0, 160), result: '' });
	}
</script>

{#if widget.type === 'clock'}
	<div class="clock-content">
		<svg class="analog-clock" viewBox="0 0 160 160" aria-hidden="true">
			<circle cx="80" cy="80" r="73" class="clock-face" />
			{#each Array(12) as _, index}<line x1="80" y1="16" x2="80" y2={index % 3 === 0 ? 24 : 20} class="clock-tick" transform={`rotate(${index * 30} 80 80)`} />{/each}
			<line x1="80" y1="85" x2="80" y2="43" class="hour-hand" transform={`rotate(${(date.getHours() % 12) * 30 + date.getMinutes() / 2} 80 80)`} />
			<line x1="80" y1="87" x2="80" y2="27" class="minute-hand" transform={`rotate(${date.getMinutes() * 6} 80 80)`} />
			<line x1="80" y1="92" x2="80" y2="24" class="second-hand" transform={`rotate(${date.getSeconds() * 6} 80 80)`} /><circle cx="80" cy="80" r="3" class="clock-center" />
		</svg>
		<time class="clock-caption">{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
	</div>
{:else if widget.type === 'world'}
	<div class="world-content">
		<select aria-label="World clock time zone" value={data.zone} onchange={event => onupdate({ zone: event.currentTarget.value })}>
			{#if !zones.some(([zone]) => zone === data.zone)}<option value={data.zone}>{data.zone}</option>{/if}
			{#each zones as [zone, label]}<option value={zone}>{label}</option>{/each}
		</select>
		<time class="large-digits">{date.toLocaleTimeString([], { timeZone: data.zone, hour: '2-digit', minute: '2-digit', hour12: false })}</time>
		<p class="muted">{date.toLocaleDateString([], { timeZone: data.zone, weekday: 'short', month: 'short', day: 'numeric' })}</p>
	</div>
{:else if widget.type === 'calendar'}
	<div class="calendar-content">
		<div class="calendar-controls"><strong>{month.label}</strong><button aria-label="Previous month" disabled={data.offset <= -120} onclick={() => onupdate({ offset: data.offset - 1 })}><Icon name="back" size={15} /></button><button aria-label="Next month" disabled={data.offset >= 120} onclick={() => onupdate({ offset: data.offset + 1 })}><Icon name="forward" size={15} /></button></div>
		<div class="calendar-grid" aria-label={month.label}>
			{#each ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as day}<span class="weekday">{day}</span>{/each}
			{#each month.cells as cell}<span class:today={cell?.today} aria-current={cell?.today ? 'date' : undefined}>{cell?.day || ''}</span>{/each}
		</div>
		<button class="text-action calendar-today" onclick={() => onupdate({ offset: 0 })}>Today</button>
	</div>
{:else if widget.type === 'focus'}
	<div class="timer-content">
		<div class="focus-progress" style:--progress={`${100 - remaining / (data.minutes * 60) * 100}%`}><span role="timer" class="large-digits">{formatDuration(remaining)}</span></div>
		<div class="presets">{#each [15, 25, 45] as minutes}<button class:selected={minutes === data.minutes} aria-pressed={minutes === data.minutes} onclick={() => focusReset(minutes)}>{minutes} min</button>{/each}</div>
		<div class="actions"><button class="primary" onclick={focusToggle}>{focusing ? 'Pause' : remaining === 0 ? 'Start again' : remaining < data.minutes * 60 ? 'Resume' : 'Start focus'}</button><button aria-label="Reset focus timer" onclick={() => focusReset()}><Icon name="reload" size={16} /></button></div>
	</div>
{:else if widget.type === 'stopwatch'}
	<div class="stopwatch-content">
		<div role="timer" class="large-digits">{formatDuration(elapsed / 1000)}</div>
		<div class="actions"><button class="primary" onclick={stopwatchToggle}>{data.since === null ? 'Start' : 'Pause'}</button><button disabled={data.since === null} onclick={() => onupdate({ ...data, lapCount: data.lapCount + 1, laps: [stopwatchElapsed(data, Date.now()), ...data.laps].slice(0, 5) })}>Lap</button><button aria-label="Reset stopwatch" onclick={() => onupdate({ elapsed: 0, since: null, laps: [], lapCount: 0 })}><Icon name="reload" size={16} /></button></div>
		<div class="lap-list">{#each data.laps as lap, index}<div><span>Lap {data.lapCount - index}</span><time>{formatDuration(lap / 1000)}</time></div>{/each}</div>
	</div>
{:else if widget.type === 'notes'}
	<div class="notes-content"><textarea aria-label="Widget note" placeholder="Write a note…" maxlength="10000" value={data.text} oninput={event => onupdate({ text: event.currentTarget.value })}></textarea><span class="muted note-count">{data.text.length.toLocaleString()} / 10,000</span></div>
{:else if widget.type === 'checklist'}
	<div class="checklist-content">
		<form class="task-add" onsubmit={addTask}><input aria-label="New task" placeholder="Add a task" maxlength="200" bind:value={task} /><button aria-label="Add task" disabled={!task.trim() || data.items.length >= 40}><Icon name="plus" size={17} /></button></form>
		<div class="task-list">{#each data.items as item (item.id)}<div class="task-row"><label><input type="checkbox" checked={item.done} onchange={event => onupdate({ items: data.items.map(x => x.id === item.id ? { ...x, done: event.currentTarget.checked } : x) })} /><span class:done={item.done}>{item.text}</span></label><button aria-label={`Remove task ${item.text}`} onclick={() => onupdate({ items: data.items.filter(x => x.id !== item.id) })}><Icon name="close" size={13} /></button></div>{/each}</div>
		<p class="muted task-count">{data.items.length ? `${data.items.filter(x => x.done).length} of ${data.items.length} complete` : 'No tasks yet'}</p>
	</div>
{:else if widget.type === 'calculator'}
	<div class="calculator-content">
		<input class="calculator-input" aria-label="Calculator expression" placeholder="0" maxlength="160" value={data.expression} oninput={event => onupdate({ expression: event.currentTarget.value, result: '' })} onkeydown={event => { if (event.key === 'Enter') { event.preventDefault(); solve(); } if (event.key === 'Escape') onupdate({ expression: '', result: '' }); }} />
		<output class="calculator-result" aria-live="polite">{data.result || '0'}</output>
		<div class="calculator-keys">{#each ['AC', '(', ')', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', '.', '⌫', '='] as key}<button class:equals={key === '='} class:operator={['÷', '×', '−', '+'].includes(key)} aria-label={key === '⌫' ? 'Backspace' : key === 'AC' ? 'Clear calculator' : key} onclick={() => calculatorKey(key)}>{key}</button>{/each}</div>
	</div>
{:else if widget.type === 'launch'}
	<div class="widget-apps">{#each apps.slice(0, 9) as app (app.id)}<button disabled={!ready} onclick={() => onlaunch(app)}><AppIcon {app} size={38} /><span>{app.name}</span></button>{/each}</div>
{:else if widget.type === 'windows'}
	<div class="widget-windows">
		{#each windows.slice().reverse() as win (win.id)}{@const app = apps.find(x => x.id === (win.parentApp ?? win.sender))}<button onclick={() => onfocus(win.sender)}>{#if app}<AppIcon {app} size={31} />{:else}<Icon name="desktop" size={24} />{/if}<span><strong>{win.name}</strong><small>{win.minimized ? 'Minimized' : 'Open'}</small></span><Icon name="arrow" size={14} /></button>{/each}
		{#if !windows.length}<div class="empty-windows"><Icon name="desktop" size={28} /><p>No open windows</p>{#if apps[0]}<button class="text-action" disabled={!ready} onclick={() => onlaunch(apps[0])}>Open browser <Icon name="arrow" size={13} /></button>{/if}</div>{/if}
	</div>
{/if}

<style>
	.muted { color: #b3c1ad; font-size: 10px; }
	.large-digits { font-size: 38px; font-weight: 300; line-height: 1.15; letter-spacing: -1.8px; font-variant-numeric: tabular-nums; white-space: nowrap; }
	button { border: 1px solid #ffffff16; border-radius: 8px; background: #ffffff08; padding: 7px 9px; font-size: 11px; }
	button:hover { background: #ffffff16; }
	button:disabled { opacity: .4; cursor: default; }
	select, input, textarea { color: #f0f3e9; background: #09170f40; border: 1px solid #ffffff1c; border-radius: 8px; min-width: 0; font: inherit; }
	select { padding: 8px; width: 100%; color-scheme: dark; font-size: 11px; }
	input { padding: 9px; }
	input[type='checkbox'] { accent-color: var(--os-accent); }
	.text-action { display: inline-flex; align-items: center; gap: 8px; color: var(--os-accent); background: transparent; border: 0; padding: 5px 0; font-size: 10px; }
	.actions { display: flex; gap: 7px; }
	.actions button { display: flex; justify-content: center; align-items: center; min-height: 34px; }
	.actions .primary { flex: 1; background: var(--os-accent); color: #293923; font-weight: 600; border-color: transparent; }
	.clock-content { height: 100%; display: flex; flex-direction: column; align-items: center; gap: 8px; }
	.analog-clock { min-height: 80px; flex: 1; max-height: calc(100% - 28px); width: 100%; }
	.clock-face { fill: #ffffff03; stroke: #ffffff24; }
	.clock-tick { stroke: #c5d3bb; stroke-width: 1.5; stroke-linecap: round; }
	.hour-hand { stroke: #f3f5eb; stroke-width: 4; stroke-linecap: round; }
	.minute-hand { stroke: #f3f5eb; stroke-width: 2.5; stroke-linecap: round; }
	.second-hand { stroke: var(--os-accent); stroke-width: 1; }
	.clock-center { fill: var(--os-accent); }
	.clock-caption { font-size: 11px; font-variant-numeric: tabular-nums; color: #dce5d1; }
	.world-content { height: 100%; display: flex; flex-direction: column; justify-content: center; gap: 14px; }
	.world-content p { margin: -8px 0 0; }
	.calendar-content { height: 100%; display: flex; flex-direction: column; }
	.calendar-controls { display: flex; align-items: center; gap: 3px; margin-bottom: 12px; }
	.calendar-controls strong { flex: 1; font-size: 12px; font-weight: 500; }
	.calendar-controls button { display: grid; place-items: center; padding: 4px; background: transparent; border: 0; }
	.calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); flex: 1; gap: 2px; }
	.calendar-grid span { display: grid; place-items: center; min-height: 23px; font-size: 11px; border-radius: 7px; }
	.calendar-grid .weekday { color: #b3c1ad; font-size: 9px; }
	.calendar-grid .today { background: var(--os-accent); color: #283d25; font-weight: 650; }
	.calendar-today { align-self: flex-end; margin-top: 8px; }
	.timer-content { display: flex; flex-direction: column; gap: 14px; justify-content: center; height: 100%; }
	.focus-progress { display: grid; place-items: center; padding: 14px 0 20px; border-bottom: 2px solid #ffffff12; border-image: linear-gradient(90deg, #d3e5b0 var(--progress), #ffffff18 var(--progress)) 1; }
	.presets { display: flex; gap: 5px; justify-content: center; }
	.presets button { border-color: transparent; background: transparent; font-size: 10px; padding: 5px 9px; color: #b3c1ad; }
	.presets button.selected { background: #ffffff0c; border-color: #ffffff15; color: #f1f4e9; }
	.stopwatch-content { display: flex; flex-direction: column; gap: 16px; padding-top: 8px; height: 100%; }
	.stopwatch-content > .large-digits { text-align: center; }
	.lap-list { overflow-y: auto; min-height: 0; }
	.lap-list div { display: flex; justify-content: space-between; border-bottom: 1px solid #ffffff0a; padding: 6px 2px; color: #c6d2bc; font-size: 10px; font-variant-numeric: tabular-nums; }
	.notes-content { height: 100%; display: flex; flex-direction: column; }
	.notes-content textarea { flex: 1; min-height: 60px; width: 100%; border: 0; background: transparent; padding: 1px 0; resize: none; outline-offset: 2px; font-family: inherit; font-size: 12px; line-height: 1.7; }
	.notes-content textarea::placeholder { color: #b3c1ad; }
	.note-count { margin-top: 10px; font-size: 9px; opacity: .7; text-align: right; }
	.checklist-content { height: 100%; display: flex; flex-direction: column; gap: 10px; }
	.task-add { display: flex; gap: 5px; }
	.task-add input { flex: 1; width: 100%; font-size: 11px; }
	.task-add button { display: grid; place-items: center; }
	.task-list { flex: 1; min-height: 0; overflow-y: auto; }
	.task-row { display: flex; align-items: flex-start; gap: 5px; margin-bottom: 5px; }
	.task-row label { display: flex; align-items: flex-start; gap: 8px; flex: 1; padding: 5px 0; font-size: 11px; line-height: 1.5; overflow-wrap: anywhere; }
	.task-row input { margin: 2px 0 0; }
	.task-row .done { opacity: .5; text-decoration: line-through; }
	.task-row button { background: none; border: 0; padding: 6px 1px; color: #aebbab; }
	.task-count { margin: 0; font-size: 9px; }
	.calculator-content { height: 100%; display: flex; flex-direction: column; gap: 8px; }
	.calculator-input { width: 100%; text-align: right; font-size: 12px; font-variant-numeric: tabular-nums; }
	.calculator-result { display: block; font-size: 29px; line-height: 1.2; letter-spacing: -1px; text-align: right; min-height: 35px; overflow-x: auto; font-variant-numeric: tabular-nums; }
	.calculator-keys { display: grid; grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(5, minmax(30px, 1fr)); flex: 1; gap: 5px; }
	.calculator-keys button { font-size: 12px; padding: 5px; }
	.calculator-keys .equals { background: var(--os-accent); color: #293923; }
	.calculator-keys .operator { background: #d3e5b012; color: var(--os-accent); }
	.widget-apps { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px 4px; align-content: start; }
	.widget-apps button { display: flex; flex-direction: column; align-items: center; gap: 9px; min-width: 0; background: none; border-color: transparent; padding: 8px 1px; }
	.widget-apps button:hover { background: #ffffff0a; }
	.widget-apps span { max-width: 100%; font-size: 9px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.widget-windows { min-height: 0; height: 100%; overflow-y: auto; }
	.widget-windows > button { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; background: none; border-color: transparent; padding: 8px 2px; }
	.widget-windows > button:hover { background: #ffffff0a; }
	.widget-windows > button > span { flex: 1; min-width: 0; display: grid; gap: 5px; }
	.widget-windows strong { font-size: 11px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.widget-windows small { font-size: 9px; color: #b3c1ad; }
	.empty-windows { display: flex; align-items: center; flex-direction: column; justify-content: center; height: 100%; gap: 10px; color: #b9c9af; }
	.empty-windows p { margin: 0; font-size: 11px; }
</style>
