<template>
    <div :class="modalOpen ? 'modal-open' : ''" class="modal h-full w-full">
        <div class="modal-box w-full max-w-4xl h-full overflow-hidden flex flex-col">
            <button @click="closeModal" class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
            
            <h1 class="font-bold text-lg text-center">Debug Console</h1>
            <p class="text-sm font-light opacity-50 text-center mb-4">All raw data from the connected device, including unrecognized formats</p>
            
                                        <!-- Controls row - status and raw data toggle -->
            <div class="flex justify-between items-center mb-2">
                <div class="text-xs text-gray-500">
                    Status: {{ isMonitoring ? 'Monitoring' : 'Ready' }}
                </div>
                <label class="flex items-center cursor-pointer">
                    <input 
                        v-model="showRawData" 
                        type="checkbox" 
                        class="checkbox checkbox-primary checkbox-xs mr-1"
                    />
                    <span class="text-xs">Show raw bytes</span>
                </label>
            </div>
            
            <!-- Debug Console Area -->
            <div ref="consoleArea" class="flex-1 bg-base-200 rounded-lg p-4 overflow-y-auto font-mono text-xs mb-4">
                <div v-if="rawData.length === 0" class="text-gray-500">
                    Debug console ready... Raw device data will appear here.
                </div>
                <div v-for="(entry, index) in filteredRawData" :key="index" class="mb-1">
                    <span class="text-blue-400">[{{ entry.timestamp }}]</span>
                    <span class="text-green-400 ml-2">{{ entry.event }}:</span>
                    <span class="text-white ml-2">{{ entry.data }}</span>
                </div>
            </div>
            
            <!-- Controls -->
            <div class="flex justify-between items-center">
                <div class="flex gap-2">
                    <button @click="startMonitoring" :disabled="isMonitoring" class="btn btn-sm btn-primary btn-outline">
                        <i class="fa-solid fa-play mr-1"></i>
                        Start Monitoring
                    </button>
                    <button @click="stopMonitoring" :disabled="!isMonitoring" class="btn btn-sm btn-error btn-outline">
                        <i class="fa-solid fa-stop mr-1"></i>
                        Stop
                    </button>
                    <button @click="clearConsole" class="btn btn-sm btn-ghost btn-outline">
                        <i class="fa-solid fa-trash mr-1"></i>
                        Clear
                    </button>
                    <button @click="copyLastMessages" class="btn btn-sm btn-info btn-outline">
                        <i class="fa-solid fa-copy mr-1"></i>
                        Copy
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/tauri';
import { writeText } from '@tauri-apps/api/clipboard';

export default {
    name: "DebugModal",
    
    props: {
        modalOpen: {
            type: Boolean,
            default: false
        },
        device: {
            type: Object,
            default: null
        }
    },
    
    emits: ['close'],
    
    computed: {
        filteredRawData() {
            if (this.showRawData) {
                return this.rawData;
            } else {
                return this.rawData.filter(entry => entry.event !== 'raw-data');
            }
        }
    },
    
    data() {
        return {
            isMonitoring: false,
            rawData: [],
            rawDataListenerDetacher: null,
            sliderListenerDetacher: null,
            deviceInfoListenerDetacher: null,
            showRawData: false
        }
    },
    
    methods: {
        async closeModal() {
            this.$emit('close');
            await this.stopMonitoring(); // Stop monitoring when modal is closed
        },
        
        async startMonitoring() {
            if (this.isMonitoring) return;
            
            this.isMonitoring = true;
            this.addLogEntry('system', 'Started monitoring raw device data...');
            
            // Enable debug mode in backend
            try {
                await invoke('toggle_debug_mode', { enabled: true });
            } catch (error) {
                this.addLogEntry('error', `Failed to enable debug mode: ${error.message}`);
            }
            
            try {
                // Listen to raw device data
                this.rawDataListenerDetacher = await listen('raw-device-data', (event) => {
                    const rawMessage = event.payload.message;
                    this.addLogEntry('raw-data', rawMessage);
                });

                // Also listen to parsed slider data if available
                this.sliderListenerDetacher = await listen('slider-change', (event) => {
                    const rawMessage = event.payload.message;
                    
                    try {
                        // Parse and log the parsed data
                        const jsonObject = JSON.parse(rawMessage);
                        const sliderArray = Object.values(jsonObject);
                        this.addLogEntry('slider-change', `Parsed: [${sliderArray.join(', ')}]`);
                    } catch (parseError) {
                        this.addLogEntry('error', `Failed to parse JSON: ${parseError.message}`);
                    }
                });

                // Listen to device info events
                this.deviceInfoListenerDetacher = await listen('device-info', (event) => {
                    const rawMessage = event.payload.message;
                    this.addLogEntry('device-info', `Device Info: ${rawMessage}`);
                });
            } catch (error) {
                this.addLogEntry('error', `Failed to start monitoring: ${error.message}`);
                this.isMonitoring = false;
            }
        },
        
        async stopMonitoring() {
            if (!this.isMonitoring) return;
            
            this.isMonitoring = false;
            this.addLogEntry('system', 'Stopped monitoring device data.');
            
            // Disable debug mode in backend
            try {
                await invoke('toggle_debug_mode', { enabled: false });
            } catch (error) {
                this.addLogEntry('error', `Failed to disable debug mode: ${error.message}`);
            }
            
            if (this.rawDataListenerDetacher) {
                this.rawDataListenerDetacher();
                this.rawDataListenerDetacher = null;
            }
            
            if (this.sliderListenerDetacher) {
                this.sliderListenerDetacher();
                this.sliderListenerDetacher = null;
            }
            
            if (this.deviceInfoListenerDetacher) {
                this.deviceInfoListenerDetacher();
                this.deviceInfoListenerDetacher = null;
            }
        },
        
        clearConsole() {
            this.rawData = [];
        },
        
        async copyLastMessages() {
            try {
                // Get the last 20 messages from filteredRawData
                const lastMessages = this.filteredRawData.slice(-20);
                
                if (lastMessages.length === 0) {
                    this.addLogEntry('system', 'No messages to copy.');
                    return;
                }
                
                // Format the messages for clipboard
                const formattedMessages = lastMessages.map(entry => 
                    `[${entry.timestamp}] ${entry.event}: ${entry.data}`
                ).join('\n');
                
                // Add header with timestamp and device info
                const header = `Debug Console Export - ${new Date().toLocaleString()}\n` +
                              `Device: ${this.device?.port_name || 'Unknown'}\n` +
                              `Messages: ${lastMessages.length}\n` +
                              `${'='.repeat(50)}\n`;
                
                const clipboardContent = header + formattedMessages;
                
                // Copy to clipboard
                await writeText(clipboardContent);
                
                this.addLogEntry('system', `Copied ${lastMessages.length} messages to clipboard.`);
            } catch (error) {
                this.addLogEntry('error', `Failed to copy to clipboard: ${error.message}`);
            }
        },
        
        addLogEntry(event, data) {
            const timestamp = new Date().toLocaleTimeString();
            this.rawData.push({
                timestamp,
                event,
                data
            });
            
            // Auto-scroll to bottom
            this.$nextTick(() => {
                if (this.$refs.consoleArea) {
                    this.$refs.consoleArea.scrollTop = this.$refs.consoleArea.scrollHeight;
                }
            });
            
            // Limit console entries to prevent memory issues
            if (this.rawData.length > 1000) {
                this.rawData = this.rawData.slice(-500); // Keep last 500 entries
            }
        }
    },
    
    mounted() {
        // Handle ESC key to close modal
        const handleEscape = (event) => {
            if (event.key === 'Escape' && this.modalOpen) {
                this.closeModal();
            }
        };
        
        document.addEventListener('keydown', handleEscape);
        
    },

    async beforeUnmount() {
        document.removeEventListener('keydown', this.handleEscape);
        await this.stopMonitoring(); // Clean up listener when component is destroyed
    }
}
</script>

<style scoped>
/* Custom scrollbar for the debug console */
.overflow-y-auto::-webkit-scrollbar {
    width: 8px;
}

.overflow-y-auto::-webkit-scrollbar-track {
    background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
    background: rgba(156, 163, 175, 0.5);
    border-radius: 4px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
    background: rgba(156, 163, 175, 0.7);
}
</style> 