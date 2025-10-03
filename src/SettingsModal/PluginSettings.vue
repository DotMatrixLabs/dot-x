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
import { resolveComponent as resolveUi, componentRegistry } from '../components/fields/registry';
import EventBus from '../js/eventBus';

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
                    if (comp && comp.key) {
                      // Initialize known value-carrying types
                      const valueTypes = ['text', 'number', 'select', 'number_select', 'switch', 'password', 'password_pin'];
                      if (valueTypes.includes(comp.type)) {
                        map[comp.key] = comp.default ?? '';
                      }
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
            if (comp.type === 'text' || comp.type === 'number' || comp.type === 'ip_address' || comp.type === 'mac_address') {
              return {
                ...common,
                disabled: comp.disabled,
                value: this.formValues[comp.key],
                label: comp.label,
                description: comp.description,
                placeholder: comp.placeholder,
                type: comp.type,
                max: comp.max,
                min: comp.min
              };
            }
            if (comp.type === 'select') {
              return {
                ...common,
                disabled: comp.disabled,
                value: this.formValues[comp.key],
                label: comp.label,
                options: comp.options || [],
              };
            }
            if (comp.type === 'number_select') {
              return {
                ...common,
                label: comp.label,
                disabled: comp.disabled,
                value: this.formValues[comp.key],
                max: comp.max,
                min: comp.min,
                step: comp.step,
                unit: comp.unit,
              };
            }
            if (comp.type === 'switch') {
              return {
                ...common,
                label: comp.label,
                disabled: comp.disabled,
                value: !!this.formValues[comp.key],
              };
            }
            if (comp.type === 'button') {
              return {
                ...common,
                disabled: comp.disabled,
                label: comp.label || 'Action',
                buttonTitle: comp.label || 'Action',
                buttonType: comp.style || 'primary',
                valueToSend: comp.valueToSend,
              };
            }
            return common;
          },

          buildComponentListeners(comp) {
            if (comp.type === 'text' || comp.type === 'number') {
              return {
                apply: async (val) => {
                  this.formValues[comp.key] = val;
                  try {
                    if (comp.onChangeActionId) {
                      await pluginAPI.emitAction(this.plugin.id, comp.onChangeActionId, { value: val });
                    }
                  } catch (e) {
                    console.error('Failed to emit onChange action:', e);
                  }
                },
              };
            }
            if (comp.type === 'select' || comp.type === 'number_select') {
              return {
                apply: (val) => {
                  this.formValues[comp.key] = val;
                },
              };
            }
            if (comp.type === 'switch') {
              return {
                apply: async (val) => {
                  this.formValues[comp.key] = !!val;
                  try {
                    if (comp.onChangeActionId) {
                      await pluginAPI.emitAction(this.plugin.id, comp.onChangeActionId, { value: !!val });
                    }
                  } catch (e) {
                    console.error('Failed to emit onChange action:', e);
                  }
                },
              };
            }
            if (comp.type === 'button') {
              return {
                apply: async () => {
                  try {
                    if (comp.actionId) {
                      await pluginAPI.emitAction(this.plugin.id, comp.actionId);
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
            // Refresh this plugin's settings when settings change events are emitted
            this._settingsUpdatedHandler = ({ pluginId }) => {
              if (!this.plugin || (pluginId && pluginId !== this.plugin.id)) return;
              this.loadSettings();
            };
            EventBus.on('plugin:settingsUpdated', this._settingsUpdatedHandler);
        },
        beforeUnmount() {
            if (this._settingsUpdatedHandler) {
              EventBus.off('plugin:settingsUpdated', this._settingsUpdatedHandler);
            }
        }
    }
</script>

<style scoped>
</style>