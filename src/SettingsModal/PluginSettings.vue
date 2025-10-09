<template>
  <div class="flex flex-col gap-4 w-full h-full overflow-y-auto p-2 pb-20">
    <PluginHeader v-if="plugin" :plugin="plugin" />

    <div class="flex flex-col gap-4">

      <div v-if="settings && settings.sections" class="flex flex-col gap-6 overflow-y-auto">
        <div v-for="(section, sIdx) in settings.sections" :key="section.key || `section_${sIdx}`" class="">
          <template v-if="!section.hidden">
            <template v-if="section.expandable">
              <details class="collapse collapse-arrow" :open="section.expanded === true" :class="{ 'opacity-50 pointer-events-none select-none': section.disabled }">
                <summary class="collapse-title font-semibold divider">
                  {{ (section.name || section.title) || 'Section' }}
                </summary>
                <div class="collapse-content flex flex-col gap-2">
                  <template v-for="(comp, cIdx) in section.components" :key="`comp_${sIdx}_${cIdx}`">
                    <component
                      :is="resolveComponent(comp.type)"
                      v-bind="buildComponentProps(comp, section)"
                      v-on="buildComponentListeners(comp)"
                    />
                  </template>
                </div>
              </details>
            </template>
            <template v-else>
              <div :class="{ 'opacity-50 pointer-events-none select-none': section.disabled }">
                <div v-if="section.name || section.title" class="divider"> {{ section.name || section.title }} </div>
                <div class="flex flex-col">
                <template v-for="(comp, cIdx) in section.components" :key="`comp_${sIdx}_${cIdx}`">
                  <component
                    :is="resolveComponent(comp.type)"
                    v-bind="buildComponentProps(comp, section)"
                    v-on="buildComponentListeners(comp)"
                  />
                </template>
                </div>
              </div>
            </template>
          </template>
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
            }
        },
        methods: {

          async loadSettings() {
            const settings = await pluginAPI.getPluginSettings(this.plugin.id);
            console.log('Settings:', settings);
            this.settings = settings;
          },


          resolveComponent(type) {
            return resolveUi(type);
          },

          // Pass through all component-defined props and inject current value
          buildComponentProps(comp) {
            if (!comp || typeof comp !== 'object') return {};

            // Avoid binding Vue's special key attribute as a prop
            const { key: compKey, ...props } = comp;

            // Only inject value for value-carrying components
            const nonValueTypes = ['button', 'link', 'display_text'];
            const shouldInjectValue = !!compKey && !nonValueTypes.includes(comp.type);

            if (shouldInjectValue) {
              const raw = (Object.prototype.hasOwnProperty.call(comp, 'default') ? comp.default : undefined);

              if (raw !== undefined) {
                props.value = comp.type === 'switch' ? !!raw : raw;
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
                  // No local state persisted; components manage their own internal value

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