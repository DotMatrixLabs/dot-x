<template>
	<!-- Permission approval dialog -->
	<dialog class="modal" :class="{ 'modal-open': permissionDialog.show }">
		<div class="modal-box max-w-sm">
			<h3 class="font-bold text-base mb-1">Permission Request</h3>
			<p class="text-sm label-text mb-3">
				<span class="font-medium">{{ permissionDialog.plugin?.name || permissionDialog.plugin?.id }}</span>
				is requesting access to the following:
			</p>
			<ul class="flex flex-col gap-1 mb-4">
				<li
					v-for="perm in permissionDialog.permissions"
					:key="perm.key"
					class="flex items-center gap-2 text-sm"
				>
					<i :class="perm.icon" class="w-4 text-center opacity-60"></i>
					<span>{{ perm.label }}</span>
				</li>
			</ul>
			<div class="modal-action mt-0">
				<button class="btn btn-sm btn-ghost" @click="denyPermissions">Deny</button>
				<button class="btn btn-sm btn-primary" @click="approvePermissions">Allow</button>
			</div>
		</div>
		<div class="modal-backdrop" @click="denyPermissions"></div>
	</dialog>

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
							<button
								v-if="pluginHasReadme(plugin)"
								class="text-left hover:underline cursor-pointer w-fit"
								@click="openPluginDetail(plugin)"
							>{{ plugin.name }}</button>
							<span v-else class="">{{ plugin.name }}</span>
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

	<!-- Plugin Detail Modal -->
	<PluginDetailModal
		:plugin="selectedPlugin"
		:is-open="showDetailModal"
		:is-installed="true"
		@close="showDetailModal = false; selectedPlugin = null"
	/>
</template>

<script>
import { useStore } from '../store/store';
import { mapState } from "pinia";
import { invoke } from "@tauri-apps/api/core";
import PluginsMarketplace from './Marketplace/PluginsMarketplace.vue';
import PluginDetailModal from './Marketplace/PluginDetailModal.vue';

export default {
	name: "Plugins",
	components: {
		PluginsMarketplace,
		PluginDetailModal,
	},

	data() {
		return {
			plugins: [],
			marketplaceOpen: false,
			refreshInterval: null,
			selectedPlugin: null,
			showDetailModal: false,
			permissionDialog: {
				show: false,
				plugin: null,
				permissions: [],
				resolve: null,
			},
		};
	},
	computed: {
		...mapState(useStore, ['activePlugins', 'enabledPlugins', 'approvedPlugins']),
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
				// Check if permissions have been approved
				if (!store.isPluginApproved(plugin.id)) {
					const perms = plugin.manifest?.permissions || [];
					if (perms.length > 0) {
						const approved = await this.requestPermissionApproval(plugin);
						if (!approved) {
							// Revert toggle
							plugin.enabled = false;
							return;
						}
					}
					await store.approvePlugin(plugin.id);
				}
				await store.enablePluginId(plugin.id);
			} else {
				await store.disablePluginId(plugin.id);
			}
		},
		requestPermissionApproval(plugin) {
			return new Promise((resolve) => {
				this.permissionDialog.plugin = plugin;
				this.permissionDialog.permissions = this.buildPermissionLabels(plugin.manifest?.permissions || []);
				this.permissionDialog.resolve = resolve;
				this.permissionDialog.show = true;
			});
		},
		buildPermissionLabels(permissions) {
			const map = {
				net: { label: 'Network access', icon: 'fa-solid fa-network-wired' },
				network: { label: 'Network access', icon: 'fa-solid fa-network-wired' },
				env: { label: 'Environment variables', icon: 'fa-solid fa-terminal' },
				read: { label: 'File system read', icon: 'fa-solid fa-folder-open' },
				write: { label: 'File system write', icon: 'fa-solid fa-pen-to-square' },
				run: { label: 'Run subprocesses', icon: 'fa-solid fa-play' },
				ffi: { label: 'Native library access (FFI)', icon: 'fa-solid fa-plug' },
				sys: { label: 'System information', icon: 'fa-solid fa-desktop' },
			};
			return permissions.map((p) => ({
				key: p,
				...(map[p.toLowerCase()] || { label: p, icon: 'fa-solid fa-shield' }),
			}));
		},
		approvePermissions() {
			this.permissionDialog.show = false;
			if (this.permissionDialog.resolve) {
				this.permissionDialog.resolve(true);
				this.permissionDialog.resolve = null;
			}
		},
		denyPermissions() {
			this.permissionDialog.show = false;
			if (this.permissionDialog.resolve) {
				this.permissionDialog.resolve(false);
				this.permissionDialog.resolve = null;
			}
		},
		pluginHasReadme(plugin) {
			const m = plugin.manifest;
			if (!m) return false;
			return !!(m.repo || (m.repository && m.repository.url));
		},
		openPluginDetail(plugin) {
			const m = plugin.manifest;
			this.selectedPlugin = {
				...m,
				id: plugin.id,
				name: plugin.name,
				author: plugin.author,
				description: plugin.description,
				repo: m?.repo || m?.repository?.url || null,
				manifest: m,
			};
			this.showDetailModal = true;
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
		},
		async backgroundRefresh() {
			try {
				const installed = await invoke("list_installed_plugins");
				if (!Array.isArray(installed)) return;
				const currentIds = new Set(this.plugins.map(p => p.id));
				const newIds = new Set(installed.map(m => m.id));
				const hasChanges = currentIds.size !== newIds.size
					|| installed.some(m => !currentIds.has(m.id))
					|| [...currentIds].some(id => !newIds.has(id));
				if (hasChanges) {
					await this.fetchPlugins();
					await this.loadEnabledState();
				}
			} catch (e) {
				// Silent background refresh - do not surface errors
			}
		},
	},

	beforeUnmount() {
		clearInterval(this.refreshInterval);
	},
	mounted() {
		this.fetchPlugins().then(() => this.loadEnabledState());
		this.refreshInterval = setInterval(() => this.backgroundRefresh(), 10000);
	},
};
</script>
