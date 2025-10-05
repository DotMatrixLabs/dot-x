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

          // Pass through all component-defined props and inject current value
          buildComponentProps(comp) {
            if (!comp || typeof comp !== 'object') return {};

            // Avoid binding Vue's special key attribute as a prop
            const { key: compKey, ...props } = comp;

            // Inject live value from form state when a key is provided
            if (compKey) {
              if (comp.type === 'switch') {
                props.value = !!this.formValues[compKey];
              } else {
                props.value = this.formValues[compKey];
              }
            }

            // Provide safe defaults for common collections
            if (comp.type === 'select' && !Array.isArray(props.options)) {
              props.options = [];
            }

            return props;
          },

          buildComponentListeners(comp) {
            return {
              apply: async (val) => {
                try {
                  // Update form state when a key is provided
                  if (comp && comp.key) {
                    if (comp.type === 'switch') {
                      this.formValues[comp.key] = !!val;
                    } else {
                      this.formValues[comp.key] = val;
                    }
                  }

                  // Fire on-change action with current value when configured
                  if (comp && comp.onChangeActionId) {
                    const payloadValue = comp.type === 'switch' ? !!val : val;
                    await pluginAPI.emitAction(this.plugin.id, comp.onChangeActionId, { value: payloadValue });
                  }

                  // Fire action for button components
                  if (comp && comp.type === 'button' && comp.actionId) {
                    await pluginAPI.emitAction(this.plugin.id, comp.actionId);
                  }
                } catch (e) {
                  console.error('Failed to handle apply event:', e);
                }
              }
            };
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