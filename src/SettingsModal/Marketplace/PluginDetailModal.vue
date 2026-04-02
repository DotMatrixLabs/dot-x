<template>
	<div v-show="isOpen" class="modal modal-open">
		<div class="modal-box max-w-5xl h-[90vh] overflow-hidden flex flex-col p-0 bg-base-200 text-base-content">
			<!-- Header -->
			<div class="px-6 py-4 border-b border-base-300">
				<div class="flex items-start justify-between gap-4">
					<!-- Left Column: Name, Version, ID, Author, Permissions -->
					<div class="flex items-start gap-3 flex-1 min-w-0">
						<button class="btn btn-ghost btn-sm btn-square shrink-0 mt-0.5" @click="close">
							<i class="fa-solid fa-arrow-left"></i>
						</button>
						<div class="flex flex-col min-w-0 flex-1 gap-1.5">
							<div class="flex items-center gap-2 flex-wrap">
								<h3 class="font-semibold text-lg leading-tight truncate">{{ plugin?.name }}</h3>
								<div v-if="manifest?.version" class="badge badge-outline badge-sm shrink-0">{{ manifest.version }}</div>
								<div class="badge badge-ghost badge-sm shrink-0">ID: {{ plugin?.id }}</div>
							</div>
							<div class="flex items-center gap-2 flex-wrap">
								<p class="text-xs label-text" v-if="author">
									by <span class="font-medium">{{ author }}</span>
								</p>
								<div v-if="isExternal" class="badge badge-outline badge-info badge-xs">External</div>
								<!-- Permissions inline -->
								<div v-if="permissions && permissions.length > 0" class="flex flex-wrap gap-1">
									<div v-for="perm in permissions" :key="perm" class="badge badge-outline badge-xs opacity-70">{{ perm }}</div>
								</div>
							</div>
						</div>
					</div>
					<!-- Right Column: Downloads, Like, Status, Actions -->
					<div class="shrink-0 flex flex-col items-end gap-2">
						<div class="flex items-center gap-3 text-sm">
							<div class="flex items-center gap-1.5">
								<i class="fa-solid fa-download opacity-70"></i>
								<span class="label-text">{{ downloadCount }}</span>
							</div>
							<div class="flex items-center gap-1.5">
								<div class="tooltip tooltip-bottom" :data-tip="isLiked ? 'Unlike' : 'Like'">
									<button 
										:class="[
											'btn btn-xs',
											isLiked ? 'btn-error' : 'btn-ghost',
											likeLoading ? 'opacity-80' : ''
										]"
										:disabled="likeLoading || !plugin?.id"
										@click="toggleLike"
									>
										<i :class="isLiked ? 'fa-solid fa-heart' : 'fa-regular fa-heart'"></i>
									</button>
								</div>
								<span class="label-text">{{ likeCount }}</span>
							</div>
							<div v-if="lastUpdated" class="flex items-center gap-1.5">
								<i class="fa-solid fa-clock opacity-70"></i>
								<span class="label-text text-xs">{{ lastUpdated }}</span>
							</div>
						</div>
						<div class="flex items-center gap-1">
							<div v-if="isInstalled && !isExternal" class="tooltip tooltip-bottom" data-tip="Logs">
								<button class="btn btn-ghost btn-sm btn-square" @click="showLogs = true">
									<i class="fa-solid fa-file-lines" />
								</button>
							</div>
							<div v-if="isInstalled && !isExternal" class="tooltip tooltip-bottom" data-tip="Restart">
								<button class="btn btn-ghost btn-sm btn-square" @click="restartPlugin" :disabled="!plugin?.id">
									<i class="fa-solid fa-rotate-right" />
								</button>
							</div>
							<div v-if="isInstalled" class="badge badge-sm shrink-0" :class="statusClass">{{ statusLabel }}</div>
							<div v-if="!isExternal" class="flex flex-col items-end gap-1">
								<button
									:class="[
										'btn btn-sm min-w-[100px] shrink-0',
										isInstalled ? 'btn-ghost' : 'btn-primary'
									]"
									@click="handleInstallAction"
								>
									<span v-if="plugin?.isDownloading" class="loading loading-spinner loading-xs"></span>
									<span v-if="plugin?.isDownloading && plugin?.downloadProgress">{{ stageLabel(plugin.downloadProgress.stage) }}</span>
									<span v-else-if="!plugin?.isDownloading && isInstalled">Uninstall</span>
									<span v-else-if="!plugin?.isDownloading">Install</span>
								</button>
								<progress
									v-if="plugin?.isDownloading && plugin?.downloadProgress"
									class="progress progress-primary w-[100px] h-1"
									:value="plugin.downloadProgress.progress"
									max="100"
								></progress>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto px-6 py-4">
				<!-- Tags -->
				<div v-if="plugin?.tags && plugin.tags.length > 0" class="flex flex-wrap gap-1 mb-4">
					<span v-for="tag in plugin.tags" :key="tag" class="badge badge-ghost badge-sm">{{ tag }}</span>
				</div>

				<!-- Links Row -->
				<div v-if="limitedLinks.length > 0" class="flex flex-nowrap items-center gap-2 mb-4 overflow-x-auto pb-1">
					<a 
						v-for="(link, idx) in limitedLinks" 
						:key="idx" 
						:href="link.url" 
						@click.prevent="openLink(link.url)"
						rel="noopener noreferrer"
						class="btn btn-outline btn-xs flex-shrink-0"
					>
						<i :class="[link.icon || 'fa-solid fa-link', 'mr-1']" /> {{ link.title || 'Link' }}
					</a>
				</div>
				<!-- README Content -->
				<div v-if="loadingReadme" class="flex items-center justify-center py-8">
					<span class="loading loading-spinner loading-md"></span>
				</div>
				<div
					v-else-if="readmeHtml"
					class="readme-prose"
					@click="onReadmeClick"
				>
					<div v-html="readmeHtml"></div>
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
import { usePluginStore } from '../../store/pluginStore';
import { toast } from 'vue-sonner';
import PluginLogsModal from '../../components/PluginLogsModal.vue';
import EventBus from '../../js/eventBus';
import MarkdownIt from 'markdown-it';
import { formatRelativeTime, openLink } from '../../ts/helpers';
import MarketplaceStats, { MARKETPLACE_REGISTRY_URL, formatMarketplaceErrorMessage } from '../../ts/marketplaceStats';

const md = new MarkdownIt({
	html: true,
	linkify: true,
	typographer: true,
	breaks: true,
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
	emits: ['close', 'download', 'uninstall', 'like', 'installed', 'uninstalled'],
	data() {
		return {
			showLogs: false,
			likeLoading: false,
			localIsLiked: false,
			localLikeCount: 0,
			localDownloadCount: 0,
			hasPendingLikeSync: false,
			readmeContent: null,
			loadingReadme: false,
			readmeHtmlUrl: null,
		};
	},
	computed: {
		...mapState(usePluginStore, ['activePlugins']),
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
			return this.plugin?.approved_permissions || this.manifest.permissions || [];
		},
		isExternal() {
			return Boolean(this.plugin?.external);
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
			const content = this.readmeContent || this.plugin?.readme;
			if (!content) return null;
			try {
				return md.render(content);
			} catch (e) {
				console.error('Failed to render markdown:', e);
				return null;
			}
		},
		isLiked() {
			return this.localIsLiked;
		},
		likeCount() {
			return this.localLikeCount;
		},
		downloadCount() {
			return this.localDownloadCount;
		},
	},
	methods: {
		openLink,
		syncLikeState() {
			this.localIsLiked = Boolean(this.plugin?.isLiked);
			this.localLikeCount = Number(this.plugin?.likes || 0);
			this.localDownloadCount = Number(this.plugin?.downloads || 0);
		},
		applyLocalStatsToPlugin() {
			if (!this.plugin) return;
			this.plugin.isLiked = this.localIsLiked;
			this.plugin.likes = this.localLikeCount;
			this.plugin.downloads = this.localDownloadCount;
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
		close() {
			if (this.hasPendingLikeSync && this.plugin?.id) {
				this.$emit('like', {
					pluginId: this.plugin.id,
					liked: this.localIsLiked,
					likes: this.localLikeCount,
				});
				this.hasPendingLikeSync = false;
			}
			this.$emit('close');
		},
		onReadmeClick(event) {
			const anchor = event?.target?.closest?.('a');
			if (!anchor) return;

			const href = anchor.getAttribute('href');
			if (!href) return;

			event.preventDefault();

			let url = href;
			if (this.readmeHtmlUrl && !/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(href)) {
				try {
					url = new URL(href, this.readmeHtmlUrl).toString();
				} catch (e) {
					return;
				}
			}

			this.openLink(url);
		},
		async handleInstallAction() {
			if (this.isInstalled) {
				await this.handleUninstall();
			} else {
				await this.handleInstall();
			}
		},
		async handleInstall() {
			if (!this.plugin?.id || this.plugin.isDownloading) return;
			this.plugin.isDownloading = true;
			try {
				await invoke('install_marketplace_plugin', {
					pluginId: this.plugin.id,
					registryUrl: MARKETPLACE_REGISTRY_URL,
				});
				void this.recordDownload();
				toast.success(`Successfully installed ${this.plugin.name || this.plugin.id}`);
				this.$emit('installed', this.plugin);
			} catch (error) {
				console.error('Failed to install plugin:', error);
				toast.error(
					formatMarketplaceErrorMessage(error, `Failed to install ${this.plugin.name || this.plugin.id}`),
				);
			} finally {
				this.plugin.isDownloading = false;
			}
		},
		async handleUninstall() {
			if (!this.plugin?.id || this.plugin.isDownloading) return;
			this.plugin.isDownloading = true;
			try {
				await usePluginStore().uninstallPluginId(this.plugin.id);
				toast.success(`Successfully uninstalled ${this.plugin.name || this.plugin.id}`);
				this.$emit('uninstalled', this.plugin);
			} catch (error) {
				console.error('Failed to uninstall plugin:', error);
				toast.error(error || `Failed to uninstall ${this.plugin.name || this.plugin.id}`);
			} finally {
				this.plugin.isDownloading = false;
			}
		},
		async toggleLike() {
			if (!this.plugin?.id || this.likeLoading) return;

			const previousLikes = this.likeCount;
			const nextLiked = !this.isLiked;
			const nextLikes = Math.max(0, previousLikes + (nextLiked ? 1 : -1));

			this.localIsLiked = nextLiked;
			this.localLikeCount = nextLikes;
			this.applyLocalStatsToPlugin();
			this.hasPendingLikeSync = true;
			this.likeLoading = true;

			await MarketplaceStats.setLocalLikeState(this.plugin.id, nextLiked, nextLikes);
			try {
				const response = await MarketplaceStats.setLike(this.plugin.id, nextLiked);
				if (response.liked !== nextLiked) {
					const resolvedLikes = Math.max(0, previousLikes + (response.liked ? 1 : -1));
					this.localIsLiked = response.liked;
					this.localLikeCount = resolvedLikes;
					this.applyLocalStatsToPlugin();
					await MarketplaceStats.setLocalLikeState(this.plugin.id, response.liked, resolvedLikes);
				}
			} catch (error) {
				console.error('Failed to update marketplace like:', error);
				toast.error(formatMarketplaceErrorMessage(error, 'Saved locally, but failed to sync like'));
			} finally {
				this.likeLoading = false;
			}
		},
		async recordDownload() {
			if (!this.plugin?.id || !this.plugin?.version) return;
			try {
				const response = await MarketplaceStats.recordDownload(
					this.plugin.id,
					this.plugin.version,
					this.localDownloadCount,
				);
				this.localDownloadCount = response.downloads;
				this.plugin.downloads = response.downloads;
			} catch (error) {
				console.error('Failed to record marketplace download:', error);
			}
		},
		async restartPlugin() {
			if (!this.plugin?.id) return;
			try {
				await invoke('restart_plugin', { pluginId: this.plugin.id });
				toast.success(`${this.plugin?.name || this.plugin?.id} restarted`);
				EventBus.emit('plugin:settingsUpdated', { pluginId: this.plugin.id });
			} catch (e) {
				console.error('Failed to restart plugin', e);
				toast.error(`Failed to restart ${this.plugin?.name || this.plugin?.id}`);
			}
		},
		parseGitHubRepo(repoUrl) {
			if (!repoUrl) return null;
			try {
				let normalizedRepoUrl = repoUrl.trim();
				if (normalizedRepoUrl.startsWith('git+')) {
					normalizedRepoUrl = normalizedRepoUrl.slice(4);
				}

				const sshMatch = normalizedRepoUrl.match(/^git@github\.com:(.+?)\/(.+?)(?:\.git)?$/);
				if (sshMatch) {
					return {
						owner: sshMatch[1],
						repo: sshMatch[2],
					};
				}

				const url = new URL(normalizedRepoUrl);
				if (url.hostname === 'github.com') {
					const pathParts = url.pathname.split('/').filter(p => p);
					if (pathParts.length >= 2) {
						return {
							owner: pathParts[0],
							repo: pathParts[1].replace(/\.git$/, ''),
						};
					}
				}
			} catch (e) {
				console.error('Failed to parse repo URL:', e);
			}
			return null;
		},
		async fetchReadme() {
			if (!this.plugin?.repo || !this.isOpen) {
				this.readmeContent = null;
				this.readmeHtmlUrl = null;
				return;
			}

			this.loadingReadme = true;
			this.readmeContent = null;
			this.readmeHtmlUrl = null;

			try {
				const repoInfo = this.parseGitHubRepo(this.plugin.repo);
				if (!repoInfo) {
					this.loadingReadme = false;
					return;
				}

				const apiUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/readme`;

				// TODO: Currently API is limited to 60 requests per hour, so we should add a api key and cache the response.
				// https://docs.github.com/en/rest/overview/resources-in-the-rest-api?apiVersion=2022-11-28#rate-limiting

				const response = await fetch(apiUrl, {
					headers: {
						'Accept': 'application/vnd.github+json',
						'X-GitHub-Api-Version': '2022-11-28',
					},
				});

				if (!response.ok) {
					throw new Error(`Failed to fetch README: ${response.statusText}`);
				}

				const data = await response.json();
				this.readmeHtmlUrl = data?.html_url || null;
				if (data.content && data.encoding === 'base64') {
					// Decode base64 content
					const decodedContent = atob(data.content);
					this.readmeContent = decodedContent;
				} else {
					throw new Error('Unexpected response format from GitHub API');
				}
			} catch (error) {
				console.error('Failed to fetch README:', error);
				this.readmeContent = null;
			} finally {
				this.loadingReadme = false;
			}
		},
	},
	watch: {
		plugin: {
			handler() {
				this.syncLikeState();
				this.hasPendingLikeSync = false;
				if (this.isOpen) {
					this.fetchReadme();
				}
			},
			immediate: true,
		},
		isOpen(newVal) {
			if (newVal && this.plugin) {
				this.fetchReadme();
			} else {
				this.readmeContent = null;
				this.loadingReadme = false;
				this.readmeHtmlUrl = null;
			}
		},
	},
};
</script>

<style scoped>
.modal-backdrop {
	@apply bg-black/50 backdrop-blur-sm;
}

/* GitHub-ish README typography */
.readme-prose {
	@apply prose max-w-none text-sm leading-relaxed;
}

.readme-prose :deep(a) {
	@apply text-primary underline underline-offset-2;
}

.readme-prose :deep(p),
.readme-prose :deep(ul),
.readme-prose :deep(ol),
.readme-prose :deep(blockquote),
.readme-prose :deep(pre),
.readme-prose :deep(table) {
	@apply my-3;
}

.readme-prose :deep(h1) {
	@apply text-2xl font-semibold mt-0 mb-4 text-base-content;
}
.readme-prose :deep(h2) {
	@apply text-xl font-semibold mt-8 mb-3 text-base-content;
}
.readme-prose :deep(h3) {
	@apply text-lg font-semibold mt-6 mb-2 text-base-content;
}
.readme-prose :deep(h4) {
	@apply text-base font-semibold mt-5 mb-2 text-base-content;
}

.readme-prose :deep(hr) {
	@apply my-6 border-base-300;
}

.readme-prose :deep(blockquote) {
	@apply border-l-4 border-base-300 pl-4 text-base-content/80;
}

.readme-prose :deep(ul) {
	@apply list-disc pl-6;
}
.readme-prose :deep(ol) {
	@apply list-decimal pl-6;
}
.readme-prose :deep(li) {
	@apply my-1;
}

/* Inline code */
.readme-prose :deep(code) {
	@apply bg-base-300 text-base-content px-1 py-0.5 rounded;
}
.readme-prose :deep(code)::before,
.readme-prose :deep(code)::after {
	content: none;
}

/* Fenced code blocks */
.readme-prose :deep(pre) {
	@apply bg-base-300 text-base-content border border-base-300 rounded-box p-4 overflow-x-auto;
}
.readme-prose :deep(pre code) {
	@apply bg-transparent p-0;
}

/* Images shouldn't blow out width */
.readme-prose :deep(img) {
	@apply max-w-full rounded-box;
}
</style>
