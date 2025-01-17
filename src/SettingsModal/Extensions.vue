<template>
    <div class="h-full">
        <div v-if="!selectedExtension" class="p-4 flex flex-col gap-2 overflow-y-scroll h-full">
            <button v-for="extension in extensions" :key="extension.name"
                class="btn btn-block justify-between bg-base-200 hover:bg-base-300 border-base-300 normal-case h-12"
                @click="navigateToExtension(extension)">
                <span>{{ extension.name }}</span>
                <span class="opacity-50 text-white w-4 h-4">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                        stroke="currentColor" class="size-6">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                </span>
            </button>
        </div>

        <div v-else class="h-full">
            <!-- Header -->
            <div class="flex items-center border-b border-base-300">
                <button @click="selectedExtension = null" class="btn btn-ghost">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                        stroke="currentColor" class="size-6 h-4 w-4">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12h-15m0 0l6.75 6.75M4.5 12l6.75-6.75" />
                    </svg>
                </button>
                <h1 class="flex-1 text-center">{{ selectedExtension.name }}</h1>
                <div class="w-10"></div> <!-- Spacer to center the title -->
            </div>

            <!-- Content -->
            <div class="space-y-6">
                <!-- Extension Details -->
                <div class="space-y-2">
                    <p class="label-text">{{ selectedExtension.description }}</p>
                </div>

                <!-- Extension Settings -->
                <div v-if="extensionSettings" class="space-y-4">
                    <h2 class="text-lg font-semibold">Settings</h2>
                    <div class="form-control">
                        <label class="label cursor-pointer">
                            <span class="label-text">Enable Extension</span>
                            <input type="checkbox" class="toggle" />
                        </label>
                    </div>
                    <div v-for="setting in extensionSettings" :key="setting.id" class="space-y-2">
                        <label class="label">{{ setting.label }}</label>
                        <component
                            :is="() => import(`../inputTypes/${setting.type}.vue`)"
                            v-bind="setting.props"
                            :value="setting.defaultValue"
                            @input="updateSetting(setting.id, $event)"
                        />
                        <p v-if="setting.description" class="text-sm text-base-content/60">
                            {{ setting.description }}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import extensionsList from '../extensions/extensions.json'

export default {
    name: "Extensions",
    data() {
        return {
            extensions: extensionsList,
            selectedExtension: null,
            extensionSettings: null
        }
    },
    methods: {
        navigateToExtension(extension) {
            this.selectedExtension = extension
            this.loadExtensionSettings(extension.location)
        },
        async loadExtensionSettings(extensionName) {
            try {
                // Load settings from a JSON file named after the extension
                const settings = await import(`../extensions/${extensionName}/settings.json`)
                this.extensionSettings = settings.default
            } catch (error) {
                console.error('Failed to load extension settings:', error)
                this.extensionSettings = null
            }
        },
        updateSetting(settingId, value) {
            // Handle setting updates here
            console.log('Setting updated:', settingId, value)
        }
    }
}
</script>

<style lang="scss" scoped>

</style>