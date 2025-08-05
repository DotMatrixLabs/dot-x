<template>
	<div class="flex flex-col h-full w-full p-4 gap-4">
		<!-- Plugin system options -->
		<div class="flex items-center justify-between">
			<div class="">
				<h2 class="">Install plugins</h2>
				<p class="text-xs px-0 label-text">Browse and install plugins to extend what Dot X can do</p>
			</div>
			<button class="btn btn-primary btn-xs" @click="installNewPlugin">
				Browse Plugins
			</button>
		</div>

		<!-- Plugin list -->
		<div class="flex flex-col overflow-y-auto">

			<div class="flex flex-row justify-between">
				<h3 class="">Installed plugins: </h3>
				<div class="">
					<button class="mx-1 btn btn-ghost btn-square btn-sm">
						r
					</button>
					<button class="mx-1 btn btn-ghost btn-square btn-sm">
						b
					</button>
				</div>

			</div>
			<div v-if="plugins.length > 0">
				<div v-for="plugin in plugins" :key="plugin.id" class="">
					<div class="divider m-0 p-0"> </div>
					<div class="flex justify-between items-start p-1">

						<!-- Plugin info -->
						<div class="flex flex-col">
							<span class="">{{ plugin.name }}</span>
							<span class="label-text text-xs">
								Version: {{ plugin.version }} • {{ plugin.author }}
							</span>
							<span class="text-xs label-text">{{ plugin.description }}</span>
						</div>
						<!-- Actions -->
						<div class="flex items-center gap-3 my-auto">
							<!-- Settings -->
							<button class="btn btn-ghost btn-square btn-sm" @click="openSettings(plugin)" title="Settings">
								D
							</button>
							<button class="btn btn-ghost btn-square btn-sm" @click="openSettings(plugin)" title="Settings">
								S
							</button>
							<!-- Enable / Disable -->
							<input type="checkbox" class="toggle toggle-primary" v-model="plugin.enabled"
								@change="togglePlugin(plugin)" />
						</div>
					</div>
				</div>
			</div>
			<div v-else>
				<div class="divider m-0"></div>
				<h3 class="label-text text-center mt-2">No plugins installed</h3>
			</div>
		</div>
	</div>
</template>

<script>
export default {
	name: "Plugins",

	data() {
		return {
			plugins: [
				{
					id: 'example-plugin',
					name: 'Example Plugin',
					version: '1.0.0',
					author: 'Jane Doe',
					description: 'An example plugin description.',
					enabled: true
				}
			],
		};
	},

	methods: {
		togglePlugin(plugin) {
			// TODO: Implement enable/disable logic
		},
		openSettings(plugin) {
			// TODO: Open plugin settings
		},
		installNewPlugin() {
			// TODO: Handle installation of new plugins
		},
	},
};
</script>
