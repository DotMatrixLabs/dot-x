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

		<div class="flex flex-col gap-2 overflow-y-auto pr-1">
			<div v-if="loading" class="flex items-center justify-center py-12">
				<span class="loading loading-spinner loading-lg"></span>
			</div>
			<template v-else>
				<div
					v-for="plugin in filteredPlugins"
					:key="plugin.id"
					class="card bg-base-200 hover:bg-base-300 cursor-pointer transition"
					@click="selectedPlugin = plugin"
				>
					<div class="card-body p-3 gap-2">
						<div class="flex items-start justify-between gap-2">
							<div class="flex flex-col gap-0.5">
								<div class="flex items-center gap-2">
									<h3 class="card-title text-sm font-semibold leading-tight text-base-content">{{ plugin.name }}</h3>
									<span v-if="isInstalled(plugin.id)" class="badge badge-primary badge-sm">Installed</span>
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
									isInstalled(plugin.id) ? 'btn-ghost' : 'btn-primary'
								]"
								@click.stop="isInstalled(plugin.id) ? $emit('uninstall', plugin) : $emit('download', plugin)"
							>
								<span v-if="plugin.isDownloading" class="loading loading-spinner loading-xs"></span>
								<span v-else-if="isInstalled(plugin.id)">Uninstall</span>
								<span v-else>Download</span>
							</button>
						</div>
					</div>
				</div>
				<div v-if="filteredPlugins.length === 0" class="text-center text-sm label-text py-6">
					No plugins match your filters.
				</div>
			</template>
		</div>

		<PluginDetailModal
			:plugin="selectedPlugin"
			:is-open="!!selectedPlugin"
			:is-installed="selectedPlugin ? isInstalled(selectedPlugin.id) : false"
			@close="selectedPlugin = null"
			@download="handleDownload"
			@uninstall="handleUninstall"
			@like="handleLike"
		/>
	</div>
</template>

<script>
import PluginDetailModal from './PluginDetailModal.vue';

export default {
	name: "PluginsMarketplace",
	components: {
		PluginDetailModal,
	},
	props: {
		installedPluginIds: { type: Set, default: () => new Set() },
	},
	emits: ["close", "download", "uninstall"],
	data() {
		return {
			searchQuery: "",
			sortOption: "newest",
			selectedPlugin: null,
			allPlugins: [],
			loading: false,
		};
	},
	computed: {
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

			return list;
		}
	},
	methods: {
		async fetchPlugins() {
			this.loading = true;
			try {
				const response = await fetch('https://dotmatrixlabs.github.io/dot-x-plugins/marketplace-registry.json');
				if (!response.ok) {
					throw new Error(`Failed to fetch registry: ${response.statusText}`);
				}
				const data = await response.json();
				this.allPlugins = (data.plugins || []).map(plugin => ({
					...plugin,
					likes: plugin.likes || 0,
					downloads: plugin.downloads || 0,
					isDownloading: false,
				}));
			} catch (error) {
				console.error('Failed to fetch plugin registry:', error);
				this.allPlugins = [];
			} finally {
				this.loading = false;
			}
		},
		isInstalled(pluginId) {
			return this.installedPluginIds.has(pluginId);
		},
		handleDownload(plugin) {
			this.$emit('download', plugin);
		},
		handleUninstall(plugin) {
			this.$emit('uninstall', plugin);
		},
		handleLike({ pluginId, liked }) {
			// Handle like action - could update plugin likes count or send to API
			const plugin = this.allPlugins.find(p => p.id === pluginId);
			if (plugin) {
				if (liked) {
					plugin.likes = (plugin.likes || 0) + 1;
				} else {
					plugin.likes = Math.max(0, (plugin.likes || 0) - 1);
				}
			}
		},
	},
	mounted() {
		this.fetchPlugins();
	},
};
</script>