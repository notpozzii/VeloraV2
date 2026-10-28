<script>
	let { name, size = 18 } = $props();
	const paths = {
		clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 7v5l3 2',
		calendar: 'M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1M8 3v4M16 3v4M4 10h16M8 14h1M12 14h1M8 17h1M12 17h1',
		focus: 'M7 3H3v4M17 3h4v4M3 17v4h4M21 17v4h-4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
		timer: 'M9 3h6M12 3v3M17 7l2-2M20 14a8 8 0 1 1-16 0 8 8 0 0 1 16 0M12 10v4l3 2',
		note: 'M5 3h14v13l-5 5H5zM14 21v-5h5M8 7h8M8 11h6',
		check: 'M4 6l2 2 4-4M13 6h7M4 15l2 2 4-4M13 15h7',
		calculator: 'M5 3h14v18H5zM8 6h8v4H8zM8 14h1M12 14h1M16 14h.01M8 18h1M12 18h1M16 18h.01',
		widgets: 'M3 3h7v7H3zM14 3h7v11h-7zM3 14h7v7H3zM14 18h7v3h-7z',
		resize: 'M9 20 20 9M14 20l6-6M19 20l1-1',
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
