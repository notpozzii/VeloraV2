import { createRelayTransport, rememberRelayFailure } from './relay-fallback.js';

export default class RelayTransport {
	constructor(options) { this.options = options; }
	get ready() { return !!this.transport?.ready; }
	get client_version() { return this.transport?.client_version; }
	async init() {
		const { module, wisp, backupWisp, selectedWisp, ...options } = this.options;
		const { default: Transport } = await import(/* @vite-ignore */ module);
		this.transport = createRelayTransport(relay => new Transport({ ...options, wisp: relay }), wisp, { backupWisp });
		if (selectedWisp && selectedWisp !== wisp) rememberRelayFailure(wisp, backupWisp);
		await this.transport.init();
	}
	meta(...args) { return this.transport.meta(...args); }
	request(...args) { return this.transport.request(...args); }
	connect(...args) { return this.transport.connect(...args); }
}
