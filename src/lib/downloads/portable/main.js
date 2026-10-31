import { mount } from 'svelte';
import Portable from './portable.svelte';
import '$lib/style/variables.css';
import '$lib/style/themes.css';
import '$lib/style/assets.css';

mount(Portable, { target: document.getElementById('velora-root') });
document.getElementById('portable-startup')?.remove();
