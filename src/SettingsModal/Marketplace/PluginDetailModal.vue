<template>
	<div v-if="isOpen" class="modal modal-open">
		<div class="modal-box max-w-5xl max-h-[90vh] flex flex-col p-0 bg-base-200 text-base-content">
			<!-- Header -->
			<div class="flex items-center justify-between px-6 py-4 border-b border-base-300">
				<div class="flex items-center gap-3 flex-1 min-w-0">
					<button class="btn btn-ghost btn-sm btn-square shrink-0" @click="close">
						<i class="fa-solid fa-arrow-left"></i>
					</button>
					<div class="flex flex-col min-w-0 flex-1">
						<div class="flex items-center gap-2 flex-wrap">
							<h3 class="font-semibold text-lg leading-tight truncate">{{ plugin?.name }}</h3>
							<div v-if="manifest?.version" class="badge badge-outline badge-sm shrink-0">v{{ manifest.version }}</div>
							<div class="badge badge-ghost badge-sm shrink-0">ID: {{ plugin?.id }}</div>
						</div>
						<p class="text-xs label-text mt-0.5" v-if="author">
							by <span class="font-medium">{{ author }}</span>
						</p>
					</div>
					<div class="shrink-0 flex items-center gap-1">
						<div v-if="isInstalled" class="tooltip tooltip-bottom" data-tip="Logs">
							<button class="btn btn-ghost btn-sm btn-square" @click="showLogs = true">
								<i class="fa-solid fa-file-lines" />
							</button>
						</div>
						<div v-if="isInstalled" class="tooltip tooltip-bottom" data-tip="Restart">
							<button class="btn btn-ghost btn-sm btn-square" @click="restartPlugin" :disabled="!plugin?.id">
								<i class="fa-solid fa-rotate-right" />
							</button>
						</div>
						<div v-if="isInstalled" class="badge badge-sm shrink-0" :class="statusClass">{{ statusLabel }}</div>
						<button 
							:class="[
								'btn btn-sm min-w-[100px] shrink-0',
								isInstalled ? 'btn-ghost' : 'btn-primary'
							]"
							@click="handleInstallAction"
						>
							<span v-if="plugin?.isDownloading" class="loading loading-spinner loading-xs"></span>
							<span v-else-if="isInstalled">Uninstall</span>
							<span v-else>Install</span>
						</button>
					</div>
				</div>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto px-6 py-4">
				<!-- Tags -->
				<div v-if="plugin?.tags && plugin.tags.length > 0" class="flex flex-wrap gap-1 mb-4">
					<span v-for="tag in plugin.tags" :key="tag" class="badge badge-ghost badge-sm">{{ tag }}</span>
				</div>

				<!-- Stats Row -->
				<div class="flex items-center gap-4 text-sm mb-4">
					<div class="flex items-center gap-1.5">
						<i class="fa-solid fa-download opacity-70"></i>
						<span class="label-text">{{ plugin?.downloads || 0 }}</span>
					</div>
					<div class="flex items-center gap-1.5">
						<button 
							class="btn btn-ghost btn-xs btn-square"
							:class="{ 'text-error': isLiked }"
							@click="toggleLike"
						>
							<i class="fa-solid fa-heart"></i>
						</button>
						<span class="label-text">{{ plugin?.likes || 0 }}</span>
					</div>
					<div v-if="lastUpdated" class="flex items-center gap-1.5">
						<i class="fa-solid fa-clock opacity-70"></i>
						<span class="label-text">Updated {{ lastUpdated }}</span>
					</div>
				</div>

				<!-- Permissions -->
				<div v-if="permissions && permissions.length > 0" class="mb-4">
					<label class="label py-1">
						<span class="label-text text-xs font-medium">Permissions</span>
					</label>
					<div class="flex flex-wrap gap-2">
						<div v-for="perm in permissions" :key="perm" class="badge badge-outline badge-sm opacity-70">{{ perm }}</div>
					</div>
				</div>

				<!-- Links Row -->
				<div v-if="limitedLinks.length > 0" class="flex flex-nowrap items-center gap-2 mb-4 overflow-x-auto pb-1">
					<a 
						v-for="(link, idx) in limitedLinks" 
						:key="idx" 
						:href="link.url" 
						target="_blank" 
						rel="noopener noreferrer" 
						class="btn btn-outline btn-xs flex-shrink-0"
					>
						<i :class="[link.icon || 'fa-solid fa-link', 'mr-1']" /> {{ link.title || 'Link' }}
					</a>
				</div>

				<!-- Description -->
				<div v-if="description" class="mb-4">
					<p class="text-sm text-base-content/90">{{ description }}</p>
				</div>

				<!-- README Content -->
				<div v-if="readmeHtml" class="prose prose-sm max-w-none prose-headings:text-base-content prose-p:text-base-content/90 prose-a:text-primary prose-code:text-base-content prose-pre:bg-base-300 prose-pre:text-base-content">
					<div v-html="readmeHtml"></div>
				</div>
				<div v-else-if="plugin?.readme" class="prose prose-sm max-w-none text-sm whitespace-pre-wrap text-base-content/90">
					{{ plugin.readme }}
				</div>
			</div>

			<!-- Footer -->
			<div class="flex items-center justify-end px-6 py-3 border-t border-base-300">
				<button class="btn btn-sm" @click="close">Close</button>
			</div>
		</div>
		<div class="modal-backdrop" @click="close"></div>

		<!-- Logs Modal -->
		<PluginLogsModal 
			v-if="isInstalled"
			:is-open="showLogs" 
			:plugin-id="plugin?.id" 
			:plugin-name="plugin?.name || plugin?.id"
			@close="showLogs = false"
		/>
	</div>
</template>

<script>
import { invoke } from '@tauri-apps/api/core';
import { mapState } from 'pinia';
import { useStore } from '../../store/store';
import { useToast } from 'vue-toastification';
import PluginLogsModal from '../../components/PluginLogsModal.vue';
import EventBus from '../../js/eventBus';
import MarkdownIt from 'markdown-it';
import { formatRelativeTime } from '../../ts/helpers';

const md = new MarkdownIt({
	html: true,
	linkify: true,
	typographer: true,
});

export default {
	name: 'PluginDetailModal',
	components: {
		PluginLogsModal,
	},
	props: {
		plugin: {
			type: Object,
			default: null,
		},
		isOpen: {
			type: Boolean,
			default: false,
		},
		isInstalled: {
			type: Boolean,
			default: false,
		},
	},
	emits: ['close', 'download', 'uninstall', 'like'],
	data() {
		return {
			showLogs: false,
			likedPlugins: new Set(), // In a real app, this would come from a store/API
		};
	},
	computed: {
		...mapState(useStore, ['activePlugins']),
		manifest() {
			return this.plugin?.manifest || this.plugin || {};
		},
		author() {
			return this.plugin?.author || this.manifest.author || null;
		},
		description() {
			return this.plugin?.description || this.manifest.description || this.manifest.longDescription || null;
		},
		permissions() {
			return this.manifest.permissions || [];
		},
		isRunning() {
			try {
				return this.activePlugins?.has?.(this.plugin?.id);
			} catch (e) {
				return false;
			}
		},
		hasError() {
			return Boolean(this.plugin?.error || this.manifest?.status === 'error');
		},
		status() {
			if (this.hasError) return 'error';
			if (this.isRunning) return 'running';
			return 'stopped';
		},
		statusLabel() {
			if (this.status === 'running') return 'Running';
			if (this.status === 'error') return 'Error';
			if (this.status === 'stopped') return 'Stopped';
			return 'Unknown';
		},
		statusClass() {
			if (this.status === 'running') return 'badge-success';
			if (this.status === 'error') return 'badge-error';
			if (this.status === 'stopped') return 'badge-neutral';
			return 'badge-ghost';
		},
		limitedLinks() {
			const raw = this.manifest.links;
			if (!raw) return [];
			const arr = Array.isArray(raw) ? raw : (typeof raw === 'object' ? Object.values(raw) : []);
			const normalized = arr
				.map((l) => {
					if (typeof l === 'string') return { title: 'Link', icon: 'fa-solid fa-link', url: l };
					if (l && typeof l === 'object') return { title: l.title || 'Link', icon: l.icon || 'fa-solid fa-link', url: l.url };
					return null;
				})
				.filter((l) => l && l.url);
			return normalized.slice(0, 4);
		},
		lastUpdated() {
			if (!this.plugin?.createdAt && !this.plugin?.updatedAt) return null;
			const date = this.plugin.updatedAt || this.plugin.createdAt;
			return formatRelativeTime(date);
		},
		readmeHtml() {
			if (!this.plugin?.readme) return null;
			try {
				return md.render(this.plugin.readme);
			} catch (e) {
				console.error('Failed to render markdown:', e);
				return null;
			}
		},
		isLiked() {
			return this.likedPlugins.has(this.plugin?.id);
		},
	},
	methods: {
		close() {
			this.$emit('close');
		},
		handleInstallAction() {
			if (this.isInstalled) {
				this.$emit('uninstall', this.plugin);
			} else {
				this.$emit('download', this.plugin);
			}
		},
		toggleLike() {
			if (this.isLiked) {
				this.likedPlugins.delete(this.plugin.id);
			} else {
				this.likedPlugins.add(this.plugin.id);
			}
			this.$emit('like', { pluginId: this.plugin.id, liked: this.isLiked });
		},
		async restartPlugin() {
			if (!this.plugin?.id) return;
			try {
				await invoke('restart_plugin', { pluginId: this.plugin.id });
				const toast = useToast();
				toast.success(`${this.plugin?.name || this.plugin?.id} restarted`);
				EventBus.emit('plugin:settingsUpdated', { pluginId: this.plugin.id });
			} catch (e) {
				console.error('Failed to restart plugin', e);
				const toast = useToast();
				toast.error(`Failed to restart ${this.plugin?.name || this.plugin?.id}`);
			}
		},
	},
};
</script>

<style scoped>
.modal-backdrop {
	@apply bg-black/50 backdrop-blur-sm;
}
</style>
