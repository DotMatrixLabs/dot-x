<template>
	<dialog class="modal" :class="{ 'modal-open': visible }">
		<div class="modal-box max-w-md max-h-[72vh] p-0 flex flex-col overflow-hidden">
			<div class="px-6 pt-5 pb-3 overflow-y-auto">
				<h3 class="font-bold text-base mb-2">About plugin system</h3>
				<p class="text-xs label-text mb-2 leading-relaxed">
					Plugins run as separate Deno processes and communicate with Dot X through the local plugin server.
					Manifest permissions are extra capabilities that users approve before a plugin starts.
				</p>
				<p class="text-xs label-text mb-3 leading-relaxed">
					Some runtime access is always available because the SDK and host need it to launch, connect, and run plugins reliably.
					This baseline access is separate from manifest permissions and is not included in the approval hash.
				</p>
				<div class="flex flex-col gap-2 mb-3">
					<div class="flex flex-row w-full justify-between items-center gap-3">
						<span class="my-auto text-xs">Make your own plugins</span>
						<button @click="openLink('https://dml.gg/plugin-sdk')" class="btn btn-xs">
							Docs<i class="fa-solid fa-book"></i>
						</button>
					</div>
					<div class="flex flex-row w-full justify-between items-center gap-3">
						<span class="my-auto text-xs">Visit the marketplace registry on GitHub</span>
						<button @click="openLink('https://dml.gg/plugin-marketplace')" class="btn btn-xs">
							Marketplace<i class="fab fa-github"></i>
						</button>
					</div>
					<div class="flex flex-row w-full justify-between items-center gap-3">
						<span class="my-auto text-xs">Request a plugin</span>
						<button @click="openLink('https://dml.gg/discord')" class="btn btn-xs">
							Discord<i class="fab fa-discord"></i>
						</button>
					</div>
				</div>
				<ul class="flex flex-col gap-1.5">
					<li
						v-for="capability in baselineRuntimeCapabilities"
						:key="capability.key"
						class="flex items-start gap-2 text-xs leading-relaxed"
					>
						<i :class="capability.icon" class="w-4 text-center opacity-60 mt-0.5"></i>
						<span>{{ capability.label }}</span>
					</li>
				</ul>
			</div>
			<div class="modal-action mt-0 px-6 py-3 border-t border-base-300">
				<button class="btn btn-sm btn-primary" @click="$emit('close')">Done</button>
			</div>
		</div>
		<div class="modal-backdrop" @click="$emit('close')"></div>
	</dialog>
</template>

<script>
import { openLink } from '../ts/helpers';

export default {
	name: 'PluginSystemInfoDialog',
	props: {
		visible: {
			type: Boolean,
			default: false,
		},
	},
	emits: ['close'],
	data() {
		return {
			baselineRuntimeCapabilities: [
				{
					key: 'env',
					label: 'A limited set of environment variables for SDK and runtime compatibility, not the full environment.',
					icon: 'fa-solid fa-terminal',
				},
				{
					key: 'plugin-dir',
					label: 'Read and write access inside the plugin install directory.',
					icon: 'fa-solid fa-folder',
				},
				{
					key: 'localhost',
					label: 'Network access to the Dot X plugin server on localhost and 127.0.0.1.',
					icon: 'fa-solid fa-network-wired',
				},
				{
					key: 'system-basics',
					label: 'Limited system account information used by runtime compatibility code.',
					icon: 'fa-solid fa-desktop',
				},
			],
		};
	},
	methods: {
		openLink,
	},
};
</script>
