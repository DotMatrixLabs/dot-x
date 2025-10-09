<template>
  <div class="flex flex-col gap-4">
    <div v-if="sections && sections.sections" class="flex flex-col gap-4">
      <div v-for="(section, sIdx) in sections.sections" :key="`section_${sIdx}`">
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
</template>

<script>
import pluginAPI from '../plugin-api/pluginAPI';
import { resolveComponent as resolveUi, componentRegistry } from './fields/registry';

export default {
  name: 'PluginSettingsRenderer',
  components: { ...componentRegistry },
  props: {
    sections: { type: Object, required: true },
    pluginId: { type: String, required: true }
  },
  methods: {
    resolveComponent(type) {
      return resolveUi(type);
    },
    buildComponentProps(comp) {
      if (!comp || typeof comp !== 'object') return {};

      const { key: compKey, ...props } = comp;

      const nonValueTypes = ['button', 'link', 'display_text'];
      const shouldInjectValue = !!compKey && !nonValueTypes.includes(comp.type);

      if (shouldInjectValue) {
        const raw = (Object.prototype.hasOwnProperty.call(comp, 'default') ? comp.default : undefined);
        if (raw !== undefined) {
          props.value = comp.type === 'switch' ? !!raw : raw;
        }
      }

      if (comp.type === 'select' && !Array.isArray(props.options)) {
        props.options = [];
      }

      return props;
    },
    buildComponentListeners(comp) {
      return {
        apply: async (val) => {
          try {
            if (comp && comp.onChangeActionId) {
              const payloadValue = comp.type === 'switch' ? !!val : val;
              await pluginAPI.emitAction(this.pluginId, comp.onChangeActionId, { value: payloadValue });
            }
            if (comp && comp.type === 'button' && comp.actionId) {
              await pluginAPI.emitAction(this.pluginId, comp.actionId);
            }
          } catch (e) {
            console.error('Failed to handle apply event:', e);
          }
        }
      };
    }
  }
}
</script>

<style scoped>
</style>


