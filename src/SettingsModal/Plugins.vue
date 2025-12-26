<template>
	<div class="flex flex-col h-full w-full p-4 gap-4 bg-base-100 text-base-content">
		<!-- Plugin system options -->
		<div v-if="!marketplaceOpen" class="flex items-center justify-between">
			<div class="">
				<h2 class="">Install plugins</h2>
				<p class="text-xs px-0 label-text">Browse and install plugins to extend what Dot X can do</p>
			</div>
			<button class="btn btn-primary btn-xs" @click="openMarketplace">
				Browse Plugins
			</button>
		</div>

		<!-- Marketplace -->
		<PluginsMarketplace
			v-else
			:installed-plugin-ids="installedPluginIds"
			@close="closeMarketplace"
			@download="downloadPlugin"
			@uninstall="uninstallPlugin"
			@installed="handlePluginInstalled"
			@uninstalled="handlePluginUninstalled"
		/>

		<!-- Plugin list -->
		<div v-if="!marketplaceOpen" class="flex flex-col overflow-y-auto">

			<div class="flex flex-row justify-between">
				<h3 class="">Installed plugins: </h3>
				<div class="">
					<button title="Reload plugins" class="mx-1 btn btn-ghost btn-square btn-sm" @click="reloadPlugins">
						<i class="fa-solid fa-rotate-right"></i>
					</button>
                    <button title="Open Plugin Folder" class="mx-1 btn btn-ghost btn-square btn-sm" @click="openPluginFolder">
						<i class="fa-solid fa-folder-open"></i>
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
							<button title="Delete plugin" class="btn btn-ghost btn-square btn-sm" @click="deletePlugin(plugin)">
								<i class="fa-solid fa-trash"></i>
							</button>
							<button title="Settings" class="btn btn-ghost btn-square btn-sm" @click="openSettings(plugin)">
								<i class="fa-solid fa-gear"></i>
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
import { useStore } from '../store/store';
import { mapState } from "pinia";
import { invoke } from "@tauri-apps/api/core";
import PluginsMarketplace from './Marketplace/PluginsMarketplace.vue';

export default {
	name: "Plugins",
	components: {
		PluginsMarketplace,
	},

	data() {
		return {
			plugins: [],
			marketplaceOpen: false,
		};
	},
	computed: {
		...mapState(useStore, ['activePlugins', 'enabledPlugins']),
		installedPluginIds() {
			return new Set(this.plugins.map(p => p.id));
		},
	},

	methods: {
		openMarketplace() {
			this.marketplaceOpen = true;
		},
		closeMarketplace() {
			this.marketplaceOpen = false;
		},
		downloadPlugin(plugin) {
			// Handled by PluginsMarketplace component now
		},
		uninstallPlugin(plugin) {
			// Handled by PluginsMarketplace component now
		},
		async handlePluginInstalled(plugin) {
			// Refresh installed plugins list
			await this.fetchPlugins();
			await this.loadEnabledState();
		},
		async handlePluginUninstalled(plugin) {
			// Refresh installed plugins list
			await this.fetchPlugins();
			await this.loadEnabledState();
		},
		async reloadPlugins() {
			await this.fetchPlugins();
			await this.loadEnabledState();
		},
		deletePlugin(plugin) {
			// TODO: Implement delete logic
		},
		async togglePlugin(plugin) {
			const store = useStore();
			if (plugin.enabled) {
				await store.enablePluginId(plugin.id);
			} else {
				await store.disablePluginId(plugin.id);
			}
		},
		openSettings(plugin) {
			this.$emit('openSettings', plugin);
			// TODO: Open plugin settings
		},
        installNewPlugin() {
			// TODO: Handle installation of new plugins
		},
        async openPluginFolder() {
            try {
                await invoke('open_plugins_folder');
            } catch (e) {
                console.error('Failed to open plugins folder', e);
            }
        },
        async fetchPlugins() {
			try {
                const installed = await invoke('list_installed_plugins');
                if (Array.isArray(installed)) {
                    this.plugins = installed.map((manifest) => ({
                        id: manifest.id,
                        name: manifest.name || manifest.id,
                        version: manifest.version,
                        author: manifest.author,
                        description: manifest.description,
                        manifest,
                        enabled: false,
                    }));
                }
			} catch (e) {
                console.error('Failed to list installed plugins', e);
			}
		},
		async loadEnabledState() {
			const store = useStore();
			await store.loadEnabledPlugins?.();
			this.plugins = this.plugins.map(p => ({
				...p,
				enabled: store.isPluginEnabled ? store.isPluginEnabled(p.id) : this.enabledPlugins.has(p.id)
			}));
		}
		
	},

	mounted() {
		this.fetchPlugins().then(() => this.loadEnabledState());
	},
};
</script>
