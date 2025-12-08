<template>
	<div class="flex flex-col gap-3 h-full">
		<div class="flex items-center gap-2">
			<button class="btn btn-ghost btn-sm" @click="$emit('close')">
				<i class="fa-solid fa-arrow-left"></i>
			</button>
			<div class="flex flex-col">
				<h2 class="text-lg font-semibold">Plugin Marketplace</h2>
				<p class="text-xs label-text">Discover and explore community plugins</p>
			</div>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<div class="relative w-full sm:w-auto">
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
								<span v-if="isInstalled(plugin.id)" class="badge badge-success badge-sm">Installed</span>
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
		</div>

		<div class="modal" :class="{ 'modal-open': !!selectedPlugin }">
			<div class="modal-box max-w-4xl bg-base-200 text-base-content">
				<div class="flex items-center gap-2 mb-3">
					<button class="btn btn-ghost btn-sm" @click="selectedPlugin = null">
						<i class="fa-solid fa-arrow-left"></i>
					</button>
					<div class="flex flex-col">
						<h3 class="font-semibold text-lg leading-tight">{{ selectedPlugin?.name }}</h3>
						<p class="text-xs label-text">by {{ selectedPlugin?.author }}</p>
					</div>
				</div>
				<div class="flex flex-wrap gap-1 mb-2">
					<span v-for="tag in selectedPlugin?.tags" :key="tag" class="badge badge-ghost badge-sm">{{ tag }}</span>
				</div>
				<div class="flex items-center gap-4 text-xs label-text mb-4">
					<span><i class="fa-solid fa-download mr-1"></i>{{ selectedPlugin?.downloads }}</span>
					<span><i class="fa-solid fa-heart mr-1"></i>{{ selectedPlugin?.likes }}</span>
				</div>
				<div class="prose max-w-none text-sm whitespace-pre-wrap">
					{{ selectedPlugin?.readme }}
				</div>
			</div>
			<div class="modal-backdrop" @click="selectedPlugin = null"></div>
		</div>
	</div>
</template>

<script>
export default {
	name: "PluginsMarketplace",
	props: {
		plugins: { type: Array, default: () => [] },
		installedPluginIds: { type: Set, default: () => new Set() },
	},
	emits: ["close", "download", "uninstall"],
	data() {
		return {
			searchQuery: "",
			sortOption: "newest",
			selectedPlugin: null,
		};
	},
	computed: {
		filteredPlugins() {
			let list = [...this.plugins];
			const query = this.searchQuery.trim().toLowerCase();

			if (query) {
				list = list.filter(p =>
					p.name.toLowerCase().includes(query) ||
					(p.description || "").toLowerCase().includes(query) ||
					(p.tags || []).some(t => t.toLowerCase().includes(query))
				);
			}

			if (this.sortOption === "downloads") {
				list.sort((a, b) => b.downloads - a.downloads);
			} else if (this.sortOption === "likes") {
				list.sort((a, b) => b.likes - a.likes);
			} else {
				list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
			}

			return list;
		}
	},
	methods: {
		isInstalled(pluginId) {
			return this.installedPluginIds.has(pluginId);
		},
	},
};
</script>