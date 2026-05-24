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
				<h3 class="">Plugins: </h3>
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
								Version: {{ plugin.version || 'Unknown' }}<span v-if="plugin.author"> • {{ plugin.author }}</span>
							</span>
							<div class="flex items-center gap-2 flex-wrap mt-0.5">
								<span class="text-xs label-text">{{ plugin.description }}</span>
								<span v-if="plugin.external" class="badge badge-outline badge-info badge-xs">External</span>
								<span v-if="plugin.updateInfo?.hasUpdate" class="badge badge-warning badge-xs">Update available</span>
								<span v-if="plugin.updateInfo?.hasUpdate" class="text-xs text-warning">Latest: {{ plugin.updateInfo.latestVersion }}</span>
							</div>
							<div v-if="plugin.validationErrors?.length" class="flex items-start gap-1.5 mt-1 p-1.5 rounded bg-warning/10 border border-warning/30">
								<i class="fa-solid fa-triangle-exclamation text-warning text-xs mt-0.5 shrink-0"></i>
								<div class="flex flex-col gap-0.5">
									<span v-for="(err, i) in plugin.validationErrors" :key="i" class="text-xs text-warning">{{ err }}</span>
								</div>
							</div>
						</div>
						<!-- Actions -->
						<div class="flex items-center gap-3 my-auto">
							<!-- Settings -->
							<button
								v-if="!plugin.external"
								title="Delete plugin"
								class="btn btn-ghost btn-square btn-sm"
								:disabled="plugin.isBusy"
								@click="deletePlugin(plugin)"
							>
								<i class="fa-solid fa-trash"></i>
							</button>
							<button v-if="!plugin.external" title="Logs" class="btn btn-ghost btn-square btn-sm" @click="openLogs(plugin)">
								<i class="fa-solid fa-file-lines"></i>
							</button>
							<button
								v-if="plugin.updateInfo?.hasUpdate"
								title="Download and install update"
								class="btn btn-ghost btn-square btn-sm"
								:disabled="plugin.isBusy"
								@click="updatePlugin(plugin)"
							>
								<span v-if="plugin.isBusy && plugin.downloadProgress" class="loading loading-spinner loading-xs"></span>
								<i v-else class="fa-solid fa-download"></i>
							</button>
							<button
								v-else
								:title="canOpenSettings(plugin) ? 'Settings' : 'Enable plugin to configure settings'"
								class="btn btn-ghost btn-square btn-sm"
								:disabled="!canOpenSettings(plugin)"
								@click="openSettings(plugin)"
							>
								<i class="fa-solid fa-gear"></i>
							</button>
							<!-- Enable / Disable -->
							<input
								v-if="!plugin.external"
								type="checkbox"
								class="toggle toggle-primary"
								:checked="plugin.enabled"
								@change="togglePlugin(plugin, $event)"
							/>
						</div>
					</div>
					<div v-if="plugin.downloadProgress" class="px-1 pb-1">
						<progress
							class="progress progress-primary w-full h-1"
							:value="plugin.downloadProgress.progress"
							max="100"
						></progress>
					</div>
				</div>
			</div>
			<div v-else>
				<div class="divider m-0"></div>
				<h3 class="label-text text-center mt-2">No plugins available</h3>
			</div>
		</div>

	</div>

	<Teleport to="body">
		<PluginDetailModal
			:plugin="selectedPlugin"
			:is-open="showDetailModal"
			:is-installed="selectedPluginInstalled"
			@close="showDetailModal = false; selectedPlugin = null; selectedPluginInstalled = false"
		/>
		<PluginLogsModal
			:is-open="showLogsModal"
			:plugin-id="selectedLogPlugin?.id || ''"
			:plugin-name="selectedLogPlugin?.name || selectedLogPlugin?.id || 'Plugin'"
			@close="showLogsModal = false; selectedLogPlugin = null"
		/>
		<Confirmation ref="deleteConfirmationModal" />
	</Teleport>
</template>

<script>
import { usePluginStore } from '../store/pluginStore';
import { mapState } from "pinia";
import { invoke } from "@tauri-apps/api/core";
import { listen } from '@tauri-apps/api/event';
import { toast } from 'vue-sonner';
import PluginsMarketplace from './Marketplace/PluginsMarketplace.vue';
import PluginDetailModal from './Marketplace/PluginDetailModal.vue';
import PluginLogsModal from '../components/PluginLogsModal.vue';
import Confirmation from '../components/Confirmation.vue';
import MarketplaceStats, {
	MARKETPLACE_REGISTRY_URL,
	resolveMarketplaceDownloadCount,
	resolveMarketplaceLikeState,
} from '../ts/marketplaceStats';

export default {
	name: "Plugins",
	components: {
		PluginsMarketplace,
		PluginDetailModal,
		PluginLogsModal,
		Confirmation,
	},
	props: {
		modalOpen: {
			type: Boolean,
			default: false,
		},
		plugin: {
			type: Object,
			default: null,
		},
	},
	emits: ['openSettings', 'installed-plugins-changed'],

	data() {
		return {
			installedPlugins: [],
			marketplaceOpen: false,
			refreshInterval: null,
			selectedPlugin: null,
			selectedPluginInstalled: false,
			showDetailModal: false,
			showLogsModal: false,
			selectedLogPlugin: null,
			unlistenProgress: null,
			pluginActionStateById: {},
			permissionDialog: {
				show: false,
				plugin: null,
				permissions: [],
				resolve: null,
			},
		};
	},
	computed: {
		...mapState(usePluginStore, ['activePlugins', 'enabledPlugins', 'approvedPlugins', 'connectedPlugins', 'pluginUpdates', 'lastPluginUpdateCheckAt']),
		plugins() {
			const installedPlugins = (this.installedPlugins || []).map((manifest) => ({
				id: manifest.id,
				name: manifest.name || manifest.id,
				version: manifest.version,
				author: manifest.author,
				description: manifest.description,
				manifest,
				enabled: this.enabledPlugins?.has?.(manifest.id) || false,
				external: false,
				validationErrors: manifest._validationErrors || [],
				updateInfo: this.pluginUpdates?.[manifest.id] || null,
				isBusy: Boolean(this.pluginActionStateById?.[manifest.id]?.busy),
				downloadProgress: this.pluginActionStateById?.[manifest.id]?.downloadProgress || null,
			}));
			const installedIds = new Set(installedPlugins.map((plugin) => plugin.id));
			const externalPlugins = Object.values(this.connectedPlugins || {})
				.filter((plugin) => !installedIds.has(plugin.id))
				.map((plugin) => ({
					id: plugin.id,
					name: plugin.name || plugin.id,
					version: plugin.version,
					author: null,
					description: 'Connected externally',
					manifest: plugin,
					enabled: false,
					external: true,
					updateInfo: null,
					isBusy: false,
					downloadProgress: null,
				}));
			return [...installedPlugins, ...externalPlugins]
				.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
		},
		installedPluginIds() {
			return new Set((this.installedPlugins || []).map((plugin) => plugin.id));
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
			await usePluginStore().refreshPluginUpdates();
		},
		async handlePluginUninstalled(plugin) {
			// Refresh installed plugins list
			await this.fetchPlugins();
			await this.loadEnabledState();
			await usePluginStore().refreshPluginUpdates();
		},
		async reloadPlugins() {
			await this.fetchPlugins();
			await this.loadEnabledState();
			await usePluginStore().refreshPluginUpdates({ silent: false });
		},
		async deletePlugin(plugin) {
			if (!plugin?.id || plugin.isBusy) {
				return;
			}

			const pluginLabel = plugin.name || plugin.id;

			try {
				await this.$refs.deleteConfirmationModal.openConfirmation(
					'Remove plugin?',
					`Are you sure you want to remove "${pluginLabel}" and all of its data? This cannot be undone.`,
					'Remove',
					'Cancel',
				);
			} catch {
				return;
			}

			this.setPluginActionState(plugin.id, { busy: true });
			try {
				await usePluginStore().uninstallPluginId(plugin.id);
				if (this.selectedPlugin?.id === plugin.id) {
					this.showDetailModal = false;
					this.selectedPlugin = null;
					this.selectedPluginInstalled = false;
				}
				if (this.selectedLogPlugin?.id === plugin.id) {
					this.showLogsModal = false;
					this.selectedLogPlugin = null;
				}
				await this.fetchPlugins();
				await this.loadEnabledState();
				await usePluginStore().refreshPluginUpdates();
				toast.success(`Successfully deleted ${pluginLabel}`);
			} catch (error) {
				console.error('Failed to delete plugin', error);
				toast.error(error || `Failed to delete ${pluginLabel}`);
			} finally {
				this.clearPluginActionState(plugin.id);
			}
		},
		stageLabel(stage) {
			const labels = {
				fetching_registry: 'Fetching...',
				downloading_package: 'Downloading...',
				verifying_package: 'Verifying...',
				extracting_package: 'Extracting...',
				validating_package: 'Validating...',
				installing: 'Installing...',
				done: 'Done',
			};
			return labels[stage] || stage;
		},
		setPluginActionState(pluginId, nextState) {
			this.pluginActionStateById = {
				...this.pluginActionStateById,
				[pluginId]: {
					...(this.pluginActionStateById?.[pluginId] || {}),
					...nextState,
				},
			};
		},
		clearPluginActionState(pluginId) {
			const nextState = { ...this.pluginActionStateById };
			delete nextState[pluginId];
			this.pluginActionStateById = nextState;
		},
		async updatePlugin(plugin) {
			if (!plugin?.id || plugin.isBusy) {
				return;
			}

			this.setPluginActionState(plugin.id, {
				busy: true,
				downloadProgress: {
					stage: 'fetching_registry',
					progress: 0,
				},
			});

			try {
				await invoke('install_marketplace_plugin', {
					pluginId: plugin.id,
					registryUrl: MARKETPLACE_REGISTRY_URL,
				});
				await this.fetchPlugins();
				await this.loadEnabledState();
				await usePluginStore().refreshPluginUpdates();
				const latestVersion = this.pluginUpdates?.[plugin.id]?.latestVersion || plugin.updateInfo?.latestVersion;
				toast.success(
					latestVersion
						? `Updated ${plugin.name || plugin.id} to ${latestVersion}`
						: `Updated ${plugin.name || plugin.id}`,
				);
			} catch (error) {
				console.error('Failed to update plugin', error);
				toast.error(error || `Failed to update ${plugin.name || plugin.id}`);
			} finally {
				this.clearPluginActionState(plugin.id);
			}
		},
		buildApprovalTarget(plugin) {
			return {
				id: plugin?.id,
				version: plugin?.manifest?.version || plugin?.version || '',
				permissions: plugin?.manifest?.permissions || [],
			};
		},
		setToggleChecked(event, checked) {
			const toggle = event?.target;
			if (toggle && typeof toggle.checked === 'boolean') {
				toggle.checked = checked;
			}
		},
		async togglePlugin(plugin, event) {
			const nextEnabled = Boolean(event?.target?.checked);
			const pluginStore = usePluginStore();
			if (nextEnabled) {
				const approvalTarget = this.buildApprovalTarget(plugin);
				// Check if permissions have been approved
				if (!pluginStore.isPluginApproved(approvalTarget)) {
					const perms = plugin.manifest?.permissions || [];
					if (perms.length > 0) {
						const approved = await this.requestPermissionApproval(plugin);
						if (!approved) {
							this.setToggleChecked(event, false);
							return;
						}
					}
					await pluginStore.approvePlugin(approvalTarget);
				}
				const started = await pluginStore.enablePluginId(plugin.id);
				if (!started) {
					this.setToggleChecked(event, false);
				}
			} else {
				await pluginStore.disablePluginId(plugin.id);
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
				hrtime: { label: 'High-resolution timers', icon: 'fa-solid fa-clock' },
				all: { label: 'Full system access', icon: 'fa-solid fa-unlock' },
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
			return !!this.resolvePluginRepo(m);
		},
		resolvePluginRepo(manifest) {
			if (!manifest) return null;

			if (typeof manifest.repo === 'string' && manifest.repo.trim()) {
				return manifest.repo.trim();
			}

			if (typeof manifest.repository === 'string' && manifest.repository.trim()) {
				return manifest.repository.trim();
			}

			if (manifest.repository && typeof manifest.repository.url === 'string' && manifest.repository.url.trim()) {
				return manifest.repository.url.trim();
			}

			return null;
		},
		async enrichPluginDetailWithMarketplaceStats(detailPlugin) {
			if (!detailPlugin?.id) {
				return detailPlugin;
			}

			try {
				const [likedPluginIds, likeCountOverrides, downloadCountOverrides, response] = await Promise.all([
					MarketplaceStats.getLikedPluginIds(),
					MarketplaceStats.getLikeCountOverrides(),
					MarketplaceStats.getDownloadCountOverrides(),
					fetch(MARKETPLACE_REGISTRY_URL),
				]);

				if (!response.ok) {
					throw new Error(`Failed to fetch registry: ${response.statusText}`);
				}

				const data = await response.json();
				const registryPlugin = (data?.plugins || []).find((entry) => entry?.id === detailPlugin.id);
				if (!registryPlugin) {
					return detailPlugin;
				}

				const localLikeState = resolveMarketplaceLikeState(
					detailPlugin.id,
					Number(registryPlugin.likes || 0),
					likedPluginIds,
					likeCountOverrides,
				);

				return {
					...registryPlugin,
					...detailPlugin,
					author: detailPlugin.author || registryPlugin.author,
					description: detailPlugin.description || registryPlugin.description,
					repo: detailPlugin.repo || registryPlugin.repo,
					tags: detailPlugin.tags?.length ? detailPlugin.tags : registryPlugin.tags,
					likes: localLikeState.likes,
					isLiked: localLikeState.isLiked,
					downloads: resolveMarketplaceDownloadCount(
						detailPlugin.id,
						Number(registryPlugin.downloads || 0),
						downloadCountOverrides,
					),
				};
			} catch (error) {
				console.error('Failed to enrich plugin detail with marketplace stats', error);
				return detailPlugin;
			}
		},
		async openPluginDetail(plugin) {
			const m = plugin.manifest;
			const detailPlugin = {
				...m,
				id: plugin.id,
				name: plugin.name,
				author: plugin.author,
				description: plugin.description,
				repo: this.resolvePluginRepo(m),
				manifest: m,
				external: plugin.external,
			};
			this.selectedPlugin = detailPlugin;
			this.selectedPluginInstalled = !plugin.external;
			this.showDetailModal = true;

			const enrichedPlugin = await this.enrichPluginDetailWithMarketplaceStats(detailPlugin);
			if (this.selectedPlugin?.id !== detailPlugin.id) {
				return;
			}
			this.selectedPlugin = enrichedPlugin;
		},
		openLogs(plugin) {
			this.selectedLogPlugin = plugin;
			this.showLogsModal = true;
		},
		canOpenSettings(plugin) {
			return this.activePlugins?.has?.(plugin?.id) || false;
		},
		openSettings(plugin) {
			if (!this.canOpenSettings(plugin)) {
				return;
			}
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
                    this.installedPlugins = installed;
					this.$emit('installed-plugins-changed', installed);
                }
			} catch (e) {
                console.error('Failed to list installed plugins', e);
			}
		},
		async loadEnabledState() {
			await usePluginStore().loadPersistedPluginState();
		},
		async backgroundRefresh() {
			try {
				await this.fetchPlugins();
				await this.loadEnabledState();
			} catch (e) {
				// Silent background refresh - do not surface errors
			}
		},
	},

	beforeUnmount() {
		clearInterval(this.refreshInterval);
		if (this.unlistenProgress) {
			this.unlistenProgress();
		}
	},
	mounted() {
		this.fetchPlugins().then(async () => {
			await this.loadEnabledState();
			await usePluginStore().refreshPluginUpdates();
		});
		this.refreshInterval = setInterval(() => this.backgroundRefresh(), 10000);
		listen('plugin-install-progress', (event) => {
			const { pluginId, stage, progress } = event.payload || {};
			if (!pluginId) {
				return;
			}

			this.setPluginActionState(pluginId, {
				busy: true,
				downloadProgress: {
					stage,
					progress,
				},
			});
		}).then((unlisten) => {
			this.unlistenProgress = unlisten;
		});
	},
};
</script>
