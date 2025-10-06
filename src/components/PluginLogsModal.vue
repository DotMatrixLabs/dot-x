<template>
  <div v-if="isOpen" class="modal modal-open">
    <div class="modal-box max-w-5xl h-[80vh] flex flex-col p-0">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-white border-opacity-10">
        <div class="flex items-center gap-3">
          <i class="fa-solid fa-file-lines text-lg opacity-70" />
          <div>
            <h3 class="font-bold text-lg">{{ pluginName }} Logs</h3>
            <p class="text-xs opacity-70">Plugin ID: {{ pluginId }}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <div class="tooltip tooltip-bottom" data-tip="Auto-scroll">
            <button 
              class="btn btn-ghost btn-sm btn-square" 
              :class="{ 'btn-active': autoScroll }"
              @click="toggleAutoScroll"
            >
              <i class="fa-solid fa-arrow-down" />
            </button>
          </div>
          <div class="tooltip tooltip-bottom" data-tip="Copy logs">
            <button class="btn btn-ghost btn-sm btn-square" @click="copyLogs">
              <i class="fa-solid fa-copy" />
            </button>
          </div>
          <div class="tooltip tooltip-bottom" data-tip="Clear logs">
            <button class="btn btn-ghost btn-sm btn-square" @click="clearLogs">
              <i class="fa-solid fa-trash" />
            </button>
          </div>
          <div class="tooltip tooltip-bottom" data-tip="Refresh">
            <button class="btn btn-ghost btn-sm btn-square" @click="refreshLogs">
              <i class="fa-solid fa-rotate-right" />
            </button>
          </div>
        </div>
      </div>

      <!-- Logs Content -->
      <div 
        ref="logsContainer"
        class="flex-1 overflow-auto p-4 font-mono text-sm"
      >
        <div v-if="isLoading && !logs" class="flex items-center justify-center h-full opacity-70">
          <div class="flex flex-col items-center gap-2">
            <i class="fa-solid fa-circle-notch fa-spin text-2xl" />
            <p class="text-sm">Loading logs...</p>
          </div>
        </div>
        <div v-else-if="hasNoLogs" class="flex items-center justify-center h-full opacity-70">
          <div class="flex flex-col items-center gap-2">
            <i class="fa-solid fa-inbox text-3xl" />
            <p class="text-sm">No logs available</p>
            <p class="text-xs">Logs will appear here once the plugin produces output</p>
          </div>
        </div>
        <div v-else class="space-y-1">
          <div 
            v-for="(line, idx) in formattedLogs" 
            :key="idx"
            class="log-line"
            :class="getLogClass(line)"
          >
            <span class="opacity-50 text-xs mr-2 select-none" aria-hidden="true">{{ idx + 1 }}</span>
            <pre v-if="line.isJson" class="whitespace-pre-wrap break-all inline">{{ line.text }}</pre>
            <span v-else class="whitespace-pre-wrap break-all">{{ line.text }}</span>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between px-6 py-3 border-t border-white border-opacity-10">
        <div class="text-xs opacity-70">
          <span v-if="logs">{{ lineCount }} lines</span>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-outline btn-sm" @click="close">Close</button>
        </div>
      </div>
    </div>
    <div class="modal-backdrop" @click="close" />
  </div>
</template>

<script>
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import { useToast } from 'vue-toastification';

export default {
  name: 'PluginLogsModal',
  props: {
    isOpen: {
      type: Boolean,
      default: false,
    },
    pluginId: {
      type: String,
      required: true,
    },
    pluginName: {
      type: String,
      default: 'Plugin',
    },
  },
  data() {
    return {
      logs: null,
      isLoading: false,
      autoScroll: true,
      unsubscribe: null,
    };
  },
  computed: {
    hasNoLogs() {
      if (!this.logs || this.logs.length === 0) return true;
      // Check if logs only contain "no logs" messages
      const lowerLogs = this.logs.toLowerCase();
      return lowerLogs.includes('no logs available') || 
             lowerLogs.includes('logs will appear') ||
             lowerLogs.includes('make sure the plugin is running');
    },
    formattedLogs() {
      if (!this.logs || this.hasNoLogs) return [];
      const lines = typeof this.logs === 'string' 
        ? this.logs.split('\n') 
        : [JSON.stringify(this.logs, null, 2)];
      
      // Process lines and combine multi-line JSON or JS-object-like blocks (with unquoted keys)
      const processed = [];
      let i = 0;
      
      while (i < lines.length) {
        const text = lines[i];
        const cleanText = text.replace(/^\[(stdout|stderr)\]\s*/, '');
        const isStderr = text.startsWith('[stderr]');
        const trimmed = cleanText.trim();

        // Find potential start of an object/array anywhere in the line
        const firstBraceIdx = (() => {
          const b1 = cleanText.indexOf('{');
          const b2 = cleanText.indexOf('[');
          if (b1 === -1) return b2;
          if (b2 === -1) return b1;
          return Math.min(b1, b2);
        })();

        const startsObjectHere = trimmed.startsWith('{') || trimmed.startsWith('[');

        // If the line starts with or contains an object/array, try to collect the full block
        if ((startsObjectHere || firstBraceIdx >= 0) && !(trimmed.endsWith('}') || trimmed.endsWith(']'))) {
          // Start collecting multi-line JSON
          // If there is a prefix before the first brace, keep it separate
          let prefixText = '';
          let initial = cleanText;
          if (!startsObjectHere && firstBraceIdx >= 0) {
            prefixText = cleanText.slice(0, firstBraceIdx).trimEnd();
            initial = cleanText.slice(firstBraceIdx);
          }

          let jsonLines = [initial];
          let braceCount = (initial.match(/\{/g) || []).length - (initial.match(/\}/g) || []).length;
          let bracketCount = (initial.match(/\[/g) || []).length - (initial.match(/\]/g) || []).length;
          
          i++;
          
          // Continue collecting until we have a complete JSON object
          while (i < lines.length && (braceCount > 0 || bracketCount > 0)) {
            const nextLine = lines[i];
            const nextClean = nextLine.replace(/^\[(stdout|stderr)\]\s*/, '');
            jsonLines.push(nextClean);
            
            braceCount += (nextClean.match(/\{/g) || []).length - (nextClean.match(/\}/g) || []).length;
            bracketCount += (nextClean.match(/\[/g) || []).length - (nextClean.match(/\]/g) || []).length;
            
            i++;
          }
          
          // Try to parse and format the complete JSON/JS-object-like block
          const combinedJson = jsonLines.join('\n');
          try {
            let parsed;
            try {
              parsed = JSON.parse(combinedJson);
            } catch (_e) {
              // Attempt to convert JS-like object (unquoted keys) to valid JSON
              // Quote keys that are not in quotes before a colon
              const quotedKeys = combinedJson
                .replace(/([\{\,\s])([A-Za-z_$][\w$-]*)\s*:/g, '$1"$2":')
                .replace(/'([^']*)'/g, '"$1"');
              parsed = JSON.parse(quotedKeys);
            }

            const pretty = JSON.stringify(parsed, null, 2);
            const fullText = prefixText ? (prefixText + '\n' + pretty) : pretty;
            processed.push({
              text: fullText,
              type: isStderr ? 'stderr' : this.detectLogType(combinedJson),
              isJson: true,
            });
          } catch (e) {
            // If parsing fails, add lines individually
            if (prefixText) {
              processed.push({
                text: prefixText,
                type: isStderr ? 'stderr' : this.detectLogType(prefixText),
                isJson: false,
              });
            }
            jsonLines.forEach(line => {
              if (line.trim().length > 0) {
                processed.push({
                  text: line,
                  type: isStderr ? 'stderr' : this.detectLogType(line),
                  isJson: false,
                });
              }
            });
          }
        } else {
          // Single line - check if it's complete JSON
          let displayText = cleanText;
          let isJson = false;
          
          try {
            if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
                (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
              const parsed = JSON.parse(trimmed);
              displayText = JSON.stringify(parsed, null, 2);
              isJson = true;
            } else if (firstBraceIdx >= 0) {
              // Inline object after text on the same line, try to parse
              const prefixText = cleanText.slice(0, firstBraceIdx).trimEnd();
              const candidate = cleanText.slice(firstBraceIdx);
              let parsed;
              try {
                parsed = JSON.parse(candidate);
              } catch (_e) {
                const quotedKeys = candidate
                  .replace(/([\{\,\s])([A-Za-z_$][\w$-]*)\s*:/g, '$1"$2":')
                  .replace(/'([^']*)'/g, '"$1"');
                parsed = JSON.parse(quotedKeys);
              }
              const pretty = JSON.stringify(parsed, null, 2);
              displayText = prefixText ? (prefixText + '\n' + pretty) : pretty;
              isJson = true;
            }
          } catch (e) {
            // Not JSON, keep as is
          }
          
          if (displayText.trim().length > 0) {
            processed.push({
              text: displayText,
              type: isStderr ? 'stderr' : this.detectLogType(cleanText),
              isJson,
            });
          }
          
          i++;
        }
      }
      
      return processed;
    },
    lineCount() {
      return this.formattedLogs.length;
    },
  },
  watch: {
    isOpen(newVal) {
      if (newVal) {
        this.fetchLogs();
        this.startEventListener();
      } else {
        this.stopEventListener();
      }
    },
    logs() {
      if (this.autoScroll) {
        this.$nextTick(() => {
          this.scrollToBottom();
        });
      }
    },
  },
  methods: {
    async fetchLogs() {
      this.isLoading = true;
      try {
        const result = await invoke('get_plugin_logs', { pluginId: this.pluginId });
        if (result) {
          this.logs = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
        } else {
          this.logs = '';
        }
      } catch (e) {
        console.error('Failed to fetch logs:', e);
        this.logs = '';
      } finally {
        this.isLoading = false;
      }
    },
    async refreshLogs() {
      await this.fetchLogs();
    },
    async clearLogs() {
      try {
        await invoke('clear_plugin_logs', { pluginId: this.pluginId });
        this.logs = '';
        const toast = useToast();
        toast.success('Logs cleared');
      } catch (e) {
        console.error('Failed to clear logs:', e);
        const toast = useToast();
        toast.error('Failed to clear logs');
      }
    },
    copyLogs() {
      if (!this.logs && (!this.formattedLogs || this.formattedLogs.length === 0)) {
        const toast = useToast();
        toast.warning('No logs to copy');
        return;
      }
      // Copy the displayed content (without line numbers or [stdout]/[stderr])
      const displayed = (this.formattedLogs && this.formattedLogs.length)
        ? this.formattedLogs.map(l => l.text).join('\n')
        : (this.logs || '');

      navigator.clipboard.writeText(displayed).then(() => {
        const toast = useToast();
        toast.success('Logs copied to clipboard');
      }).catch((e) => {
        console.error('Failed to copy logs:', e);
        const toast = useToast();
        toast.error('Failed to copy logs');
      });
    },
    toggleAutoScroll() {
      this.autoScroll = !this.autoScroll;
      if (this.autoScroll) {
        this.scrollToBottom();
      }
    },
    scrollToBottom() {
      const container = this.$refs.logsContainer;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    },
    detectLogType(text) {
      const lower = text.toLowerCase();
      if (lower.includes('error') || lower.includes('err:')) return 'error';
      if (lower.includes('warn') || lower.includes('warning')) return 'warn';
      if (lower.includes('info') || lower.includes('log:')) return 'info';
      if (lower.includes('debug')) return 'debug';
      return 'default';
    },
    getLogClass(line) {
      switch (line.type) {
        case 'stderr':
          return 'text-error';
        case 'error':
          return 'text-error';
        case 'warn':
          return 'text-warning';
        case 'info':
          return 'text-info';
        case 'debug':
          return 'opacity-60';
        default:
          return 'text-base-content';
      }
    },
    async startEventListener() {
      // Listen for real-time log events from Tauri
      this.unsubscribe = await listen('plugin-log', (event) => {
        const payload = event.payload;
        
        // Only process events for this plugin
        if (payload.pluginId !== this.pluginId) return;
        
        // Append new log line
        const prefix = payload.type === 'stderr' ? '[stderr]' : '[stdout]';
        const newLine = `${prefix} ${payload.message}`;
        
        if (!this.logs || this.hasNoLogs) {
          this.logs = newLine;
        } else {
          this.logs += '\n' + newLine;
        }
      });
    },
    stopEventListener() {
      if (this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = null;
      }
    },
    close() {
      this.$emit('close');
    },
  },
  beforeUnmount() {
    this.stopEventListener();
  },
};
</script>

<style scoped>
.log-line {
  @apply py-0.5 px-2 rounded hover:bg-base-100/50 transition-colors;
}

.modal-backdrop {
  @apply bg-black/50 backdrop-blur-sm;
}
</style>

