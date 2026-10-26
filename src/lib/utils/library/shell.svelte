<script>
	import Icon from '$lib/utils/browser/icon.svelte';
	import '$lib/style/apps.css';
	let {
		section,
		count,
		savedCount = 0,
		collection = 'all',
		oncollection,
		categories = [],
		category = '',
		oncategory,
		children
	} = $props();
</script>

<div class="velora-library">
	<main class="collection-main" aria-label={`${section} library`}>
		<div class="collection-filterbar">
			<div class="collection-views" role="group" aria-label="Library collection">
				<button
					class:chosen={collection === 'all'}
					aria-pressed={collection === 'all'}
					onclick={() => oncollection('all')}
					><Icon name="apps" size={15} /><span>All {section}</span><small>{count}</small></button
				>
				<button
					class:chosen={collection === 'saved'}
					aria-pressed={collection === 'saved'}
					onclick={() => oncollection('saved')}
					><Icon name={section === 'games' ? 'star' : 'bookmark'} size={15} /><span
						>{section === 'games' ? 'Favorites' : 'Pinned'}</span
					><small>{savedCount}</small></button
				>
			</div>
			<div class="category-list" role="group" aria-label="Categories">
				<button
					class:category-selected={!category}
					aria-pressed={!category}
					onclick={() => oncategory('')}>All categories</button
				>
				{#each categories as item (item.id)}
					<button
						class:category-selected={category === item.id}
						aria-pressed={category === item.id}
						onclick={() => oncategory(category === item.id ? '' : item.id)}
						><span>{item.label}</span><small>{item.count}</small></button
					>
				{/each}
			</div>
		</div>
		{@render children()}
	</main>
</div>
