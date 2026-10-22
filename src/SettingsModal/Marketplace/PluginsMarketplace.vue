<template>
	<div class="flex flex-col gap-1.5 h-full">
		<div class="flex items-center gap-1.5">
			<button class="btn btn-ghost btn-sm" @click="$emit('close')">
				<i class="fa-solid fa-arrow-left"></i>
			</button>
			<div class="flex flex-col gap-0.5">
				<h2 class="text-lg font-semibold">Plugin Marketplace</h2>
				<p class="text-xs label-text">Discover and explore community plugins</p>
			</div>
		</div>

		<div class="flex flex-col gap-1.5">
			<div class="flex items-center justify-between gap-2">
				<div class="relative flex-1">
					<input
						type="text"
						class="input input-bordered input-sm pl-8 w-full"
						placeholder="Search plugins"
						v-model="searchQuery"
					/>
					<i class="fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50"></i>
				</div>
				<select
					class="select select-bordered select-sm"
					v-model="sortOption"
				>
					<option value="newest">Newest</option>
					<option value="downloads">Most Downloaded</option>
					<option value="likes">Most Liked</option>
				</select>
			</div>
			<label class="flex items-center justify-end gap-2 cursor-pointer">
				<span class="label-text text-xs">Show incompatible</span>
				<input
					type="checkbox"
					class="toggle toggle-sm toggle-primary"
					v-model="showIncompatible"
				/>
			</label>
		</div>

		<div class="flex flex-col gap-2 overflow-y-auto pr-1">
			<div v-if="loading" class="flex items-center justify-center py-12">
				<span class="loading loading-spinner loading-lg"></span>
			</div>
			<template v-else>
				<div
					v-for="plugin in filteredPlugins"
					:key="plugin.id"
					:class="[
						'card bg-base-200 cursor-pointer transition',
						isCompatible(plugin) ? 'hover:bg-base-300' : 'opacity-60',
					]"
					@click="selectedPlugin = plugin"
				>
					<div class="card-body p-3 gap-2">
						<div class="flex items-start justify-between gap-2">
							<div class="flex flex-col gap-0.5">
								<div class="flex items-center gap-2 flex-wrap">
									<h3 class="card-title text-sm font-semibold leading-tight text-base-content">{{ plugin.name }}</h3>
									<span v-if="isInstalled(plugin.id)" class="badge badge-primary badge-sm">Installed</span>
									<span
										v-if="!isCompatible(plugin) && incompatibleBadgeLabel"
										class="badge badge-warning badge-sm"
									>{{ incompatibleBadgeLabel }}</span>
								</div>
								<p class="text-xs text-base-content/80">{{ plugin.description }}</p>
								<p class="text-xs text-base-content/60">by {{ plugin.author }}</p>
							</div>
							<div class="flex flex-col text-right text-xs text-base-content/60 gap-1 min-w-[80px]">
								<span><i class="fa-solid fa-download mr-1"></i>{{ plugin.downloads }}</span>
								<span><i class="fa-solid fa-heart mr-1"></i>{{ plugin.likes }}</span>
							</div>
						</div>
						<div class="flex items-center justify-between gap-2">
							<div class="flex flex-wrap gap-1">
								<span v-for="tag in plugin.tags" :key="tag" class="badge badge-ghost badge-sm">{{ tag }}</span>
							</div>
							<button
								:class="[
									'btn btn-sm min-w-[100px]',
									isInstalled(plugin.id) ? 'btn-ghost' : 'btn-primary',
									!isCompatible(plugin) && !isInstalled(plugin.id) ? 'btn-disabled' : '',
								]"
								@click.stop="isInstalled(plugin.id) ? handleUninstall(plugin) : handleInstall(plugin)"
								:disabled="plugin.isDownloading || (!isCompatible(plugin) && !isInstalled(plugin.id))"
							>
								<span v-if="plugin.isDownloading" class="loading loading-spinner loading-xs"></span>
								<span v-if="plugin.isDownloading && plugin.downloadProgress">{{ stageLabel(plugin.downloadProgress.stage) }}</span>
								<span v-else-if="!plugin.isDownloading && isInstalled(plugin.id)">Uninstall</span>
								<span v-else-if="!plugin.isDownloading">Install</span>
							</button>
						</div>
						<progress
							v-if="plugin.isDownloading && plugin.downloadProgress"
							class="progress progress-primary w-full h-1"
							:value="plugin.downloadProgress.progress"
							max="100"
						></progress>
					</div>
				</div>
				<div v-if="filteredPlugins.length === 0" class="text-center text-sm label-text py-6">
					No plugins match your filters.
				</div>
			</template>
		</div>

		<Teleport to="body">
			<PluginDetailModal
				v-if="selectedPlugin"
				:key="selectedPlugin.id"
				:plugin="selectedPlugin"
				:is-open="true"
				:is-installed="isInstalled(selectedPlugin.id)"
				:is-compatible="isCompatible(selectedPlugin)"
				:incompatible-badge-label="incompatibleBadgeLabel"
				@close="selectedPlugin = null"
				@download="handleDownload"
				@uninstall="handleUninstall"
				@like="handleLike"
				@installed="handlePluginInstalled"
				@uninstalled="handlePluginUninstalled"
			/>
		</Teleport>
	</div>
</template>

<script>
import { listen } from '@tauri-apps/api/event';
import { toast } from 'vue-sonner';
import PluginDetailModal from './PluginDetailModal.vue';
import { usePluginStore } from '../../store/pluginStore';
import MarketplaceStats, {
	MARKETPLACE_REGISTRY_URL,
	formatMarketplaceErrorMessage,
	resolveMarketplaceDownloadCount,
	resolveMarketplaceLikeState,
} from '../../ts/marketplaceStats';
import {
	getCurrentMarketplacePlatform,
	getIncompatibleBadgeLabel,
	isPluginPlatformCompatible,
} from '../../ts/platform';
import { createLogger } from '../../ts/logger.ts';

const log = createLogger('marketplace');

export default {
	name: "PluginsMarketplace",
	components: {
		PluginDetailModal,
	},
	props: {
		installedPluginIds: { type: Set, default: () => new Set() },
	},
	emits: ["close", "download", "uninstall", "installed", "uninstalled"],
	data() {
		return {
			searchQuery: "",
			sortOption: "newest",
			showIncompatible: false,
			currentPlatform: null,
			selectedPlugin: null,
			allPlugins: [],
			loading: false,
			unlistenProgress: null,
		};
	},
	computed: {
		incompatibleBadgeLabel() {
			return getIncompatibleBadgeLabel(this.currentPlatform);
		},
		filteredPlugins() {
			let list = [...this.allPlugins];
			const query = this.searchQuery.trim().toLowerCase();

			if (query) {
				list = list.filter(p =>
					p.name.toLowerCase().includes(query) ||
					(p.description || "").toLowerCase().includes(query) ||
					(p.tags || []).some(t => t.toLowerCase().includes(query))
				);
			}

			if (this.sortOption === "downloads") {
				list.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
			} else if (this.sortOption === "likes") {
				list.sort((a, b) => (b.likes || 0) - (a.likes || 0));
			} else {
				// Sort by generated_at from registry or fallback to downloads
				list.sort((a, b) => {
					if (a.generated_at && b.generated_at) {
						return new Date(b.generated_at) - new Date(a.generated_at);
					}
					return (b.downloads || 0) - (a.downloads || 0);
				});
			}

			if (!this.showIncompatible) {
				list = list.filter((plugin) => this.isCompatible(plugin));
			}

			return list;
		}
	},
	methods: {
		async fetchPlugins() {
			this.loading = true;
			try {
				const likedPluginIds = await MarketplaceStats.getLikedPluginIds();
				const likeCountOverrides = await MarketplaceStats.getLikeCountOverrides();
				const downloadCountOverrides = await MarketplaceStats.getDownloadCountOverrides();
				const response = await fetch(MARKETPLACE_REGISTRY_URL);
				if (!response.ok) {
					throw new Error(`Failed to fetch registry: ${response.statusText}`);
				}
				const data = await response.json();
				this.allPlugins = (data.plugins || []).map((plugin) => {
					const localLikeState = resolveMarketplaceLikeState(
						plugin.id,
						Number(plugin.likes || 0),
						likedPluginIds,
						likeCountOverrides,
					);

					return {
						...plugin,
						likes: localLikeState.likes,
						downloads: resolveMarketplaceDownloadCount(
							plugin.id,
							Number(plugin.downloads || 0),
							downloadCountOverrides,
						),
						isLiked: localLikeState.isLiked,
						isDownloading: false,
						downloadProgress: null,
					};
				});
			} catch (error) {
				log.error('Failed to fetch plugin registry:', error);
				this.allPlugins = [];
			} finally {
				this.loading = false;
			}
		},
		isInstalled(pluginId) {
			return this.installedPluginIds.has(pluginId);
		},
		isCompatible(plugin) {
			return isPluginPlatformCompatible(plugin?.platforms, this.currentPlatform);
		},
		async handleInstall(plugin) {
			if (plugin.isDownloading || !this.isCompatible(plugin)) return;
			plugin.isDownloading = true;
			try {
				await usePluginStore().installMarketplacePlugin(plugin.id, MARKETPLACE_REGISTRY_URL);
				void this.recordDownload(plugin);
				toast.success(`Successfully installed ${plugin.name}`);
				this.$emit('installed', plugin);
			} catch (error) {
				log.error('Failed to install plugin:', error);
				toast.error(formatMarketplaceErrorMessage(error, `Failed to install ${plugin.name}`));
			} finally {
				plugin.isDownloading = false;
			}
		},
		async handleUninstall(plugin) {
			if (plugin.isDownloading) return;
			plugin.isDownloading = true;
			try {
				await usePluginStore().uninstallPluginId(plugin.id);
				toast.success(`Successfully uninstalled ${plugin.name}`);
				this.$emit('uninstalled', plugin);
			} catch (error) {
				log.error('Failed to uninstall plugin:', error);
				toast.error(error || `Failed to uninstall ${plugin.name}`);
			} finally {
				plugin.isDownloading = false;
			}
		},
		handleDownload(plugin) {
			this.handleInstall(plugin);
		},
		handleLike({ pluginId, liked, likes }) {
			const nextLikes = typeof likes === 'number' ? likes : undefined;
			this.allPlugins = this.allPlugins.map((plugin) => {
				if (plugin.id !== pluginId) {
					return plugin;
				}

				return {
					...plugin,
					isLiked: liked,
					likes: nextLikes ?? plugin.likes,
				};
			});
		},
		async recordDownload(plugin) {
			if (!plugin?.id || !plugin?.version) return;
			try {
				const response = await MarketplaceStats.recordDownload(
					plugin.id,
					plugin.version,
					Number(plugin.downloads || 0),
				);
				plugin.downloads = response.downloads;
			} catch (error) {
				log.error('Failed to record marketplace download:', error);
			}
		},
		handlePluginInstalled(plugin) {
			this.$emit('installed', plugin);
		},
		handlePluginUninstalled(plugin) {
			this.$emit('uninstalled', plugin);
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
	},
	beforeUnmount() {
		if (this.unlistenProgress) {
			this.unlistenProgress();
		}
	},
	async mounted() {
		this.currentPlatform = await getCurrentMarketplacePlatform();
		this.fetchPlugins();
		listen('plugin-install-progress', (event) => {
			const { pluginId, stage, progress } = event.payload;
			const plugin = this.allPlugins.find(p => p.id === pluginId);
			if (plugin) {
				plugin.downloadProgress = { stage, progress };
			}
		}).then(unlisten => { this.unlistenProgress = unlisten; });
	},
};
</script>
