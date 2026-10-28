<script>
	let { name, size = 18 } = $props();
	const paths = {
		sidebar: 'M9 4v16M4 4h16v16H4z',
		search: 'M16 16l4 4M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0',
		back: 'm14 6-6 6 6 6',
		forward: 'm10 6 6 6-6 6',
		reload: 'M20 7v5h-5M19 12a7 7 0 1 0-2 5M20 12l-3-5',
		plus: 'M12 5v14M5 12h14',
		close: 'm6 6 12 12M6 18 18 6',
		star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z',
		bookmark: 'M6 3h12v18l-6-4-6 4z',
		settings: 'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6',
		games:
			'M7 7h10c2 0 3 2 3.5 5l.5 5c0 2-2 3-3 1l-2-3H8l-2 3c-1 2-3 1-3-1l.5-5C4 9 5 7 7 7zM8 9v4M6 11h4M16 10h.01M18 12h.01',
		extensions: 'M4 4h5a3 3 0 1 1 6 0h5v5a3 3 0 1 0 0 6v5h-5a3 3 0 1 0-6 0H4v-5a3 3 0 1 1 0-6z',
		fullscreen: 'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5',
		globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18',
		arrow: 'M4 12h16m-6-6 6 6-6 6',
		apps: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
		desktop: 'M3 4h18v13H3zM12 17v4M8 21h8'
	};
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.5"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"><path d={paths[name] || paths.globe} /></svg
>
