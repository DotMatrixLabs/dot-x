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
            <div class="space-y-6 pb-12 overflow-y-scroll h-full px-2">
                <!-- Extension Details -->
                <div class="space-y-2 text-left">
                    <p class="label-text">{{ selectedExtension.description }}</p>
                </div>

                <!-- Extension Settings -->
                <div class="space-y-4">
                    <h2 class="text-lg font-semibold">Settings</h2>
                    <div 
                        v-for="setting in extensionSettings" 
                        :key="setting.id" 
                        class="space-y-2"
                        v-memo="[getSettingValue(setting), isSettingDisabled(setting)]"
                    >
                        <component
                            :is="getInputComponent(setting.type)"
                            v-bind="setting.props"
                            :value="getSettingValue(setting)"
                            :disabled="isSettingDisabled(setting)"
                            @valueChange="updateSetting(setting.id, $event)"
                        />
                        <p v-if="setting.props.helperText" class="text-sm text-base-content/60">
                            {{ setting.props.helperText }}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import extensionsList from '../extensions/extensions.json'
import { defineAsyncComponent } from 'vue'

export default {
    name: "Extensions",
    data() {
        return {
            extensions: extensionsList,
            selectedExtension: null,
            extensionSettings: null,
            settingValues: {}
        }
    },
    methods: {
        getInputComponent(type) {
            return defineAsyncComponent(() => import(`../inputTypes/${type}.vue`))
        },
        navigateToExtension(extension) {
            this.selectedExtension = extension
            this.loadExtensionSettings(extension.location)
        },
        async loadExtensionSettings(extensionName) {
            try {
                // Load settings from a JSON file named after the extension
                const settings = await import(`../extensions/${extensionName}/settings.json`)
                console.log(settings)
                this.extensionSettings = settings.default
            } catch (error) {
                console.error('Failed to load extension settings:', error)
                this.extensionSettings = null
            }
        },
        getSettingValue(setting) {
            return this.settingValues[setting.id] !== undefined 
                ? this.settingValues[setting.id] 
                : setting.defaultValue
        },
        updateSetting(settingId, value) {
            this.settingValues[settingId] = value
            console.log('Setting updated:', settingId, value)
        },
        isSettingDisabled(setting) {
            if (!setting.dependsOn) return false
            
            const dependentSetting = setting.dependsOn.setting
            const requiredValue = setting.dependsOn.value
            return this.getSettingValue({ id: dependentSetting }) !== requiredValue
        }
    }
}
</script>

<style lang="scss" scoped>

</style>