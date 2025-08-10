<template>
  <div class="flex flex-col gap-4 w-full h-full overflow-y-auto p-2 pb-20">
    <PluginHeader v-if="plugin" :plugin="plugin" />

    <div class="flex flex-col gap-4">

      <div v-if="settings && settings.sections" class="flex flex-col gap-6 overflow-y-auto">
        <div v-for="(section, sIdx) in settings.sections" :key="`section_${sIdx}`" class="">
          <div class="divider"> {{ section.title }} </div>
          <div class="flex flex-col">
            <template v-for="(comp, cIdx) in section.components" :key="`comp_${sIdx}_${cIdx}`">
              <component
                :is="resolveComponent(comp.type)"
                v-bind="buildComponentProps(comp)"
                v-on="buildComponentListeners(comp)"
              />
            </template>
          </div>
        </div>
      </div>

      <div v-else class="opacity-70 text-sm">No settings available.</div>
    </div>
  </div>
  
</template>

<script>
import PluginHeader from './PluginHeader.vue';
import pluginAPI from '../plugin-api/pluginAPI';
import { resolveComponent as resolveUi, componentRegistry } from '../uikit/registry';

    export default {
        name: "PluginSettings",
        components: { PluginHeader, ...componentRegistry },
        props: {
            plugin: {
                type: Object,
                required: true
            }
        },
        data() {
            return {
                settings: {},
                formValues: {},
            }
        },
        methods: {

          async loadSettings() {
            const settings = await pluginAPI.getPluginSettings(this.plugin.id);
            console.log('Settings:', settings);
            this.settings = settings;
            this.initFormValues();
          },

          initFormValues() {
            const map = {};
            if (this.settings && Array.isArray(this.settings.sections)) {
              this.settings.sections.forEach(section => {
                if (Array.isArray(section.components)) {
                  section.components.forEach(comp => {
                    if (comp && comp.key && comp.type === 'text') {
                      map[comp.key] = comp.default ?? '';
                    }
                  });
                }
              });
            }
            this.formValues = map;
          },

          resolveComponent(type) {
            return resolveUi(type);
          },

          buildComponentProps(comp) {
            const common = {};
            if (comp.type === 'text') {
              return {
                ...common,
                modelValue: this.formValues[comp.key],
                label: comp.label,
                description: comp.description,
                placeholder: comp.placeholder,
              };
            }
            if (comp.type === 'button') {
              return {
                ...common,
                label: comp.label || 'Action',
              };
            }
            return common;
          },

          buildComponentListeners(comp) {
            if (comp.type === 'text') {
              return {
                'update:modelValue': (val) => {
                  this.formValues[comp.key] = val;
                },
                change: async () => {
                  try {
                    if (comp.onChangeActionId) {
                      await pluginAPI.emitSettingsAction(comp.onChangeActionId);
                    }
                  } catch (e) {
                    console.error('Failed to emit onChange action:', e);
                  }
                },
              };
            }
            if (comp.type === 'button') {
              return {
                click: async () => {
                  try {
                    if (comp.actionId) {
                      console.log('Emitting button action:', comp.actionId);
                      await pluginAPI.emitSettingsAction(comp.actionId);
                    }
                  } catch (e) {
                    console.error('Failed to emit button action:', e);
                  }
                },
              };
            }
            return {};
          },
            
        },
        computed: {
        },
        created() {
        },
        mounted() {
            this.loadSettings();
        }
    }
</script>

<style scoped>
</style>