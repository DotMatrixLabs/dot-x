import UiTextInput from './UiTextInput.vue';
import UiButton from './UiButton.vue';

export const componentRegistry: Record<string, any> = {
  text: UiTextInput,
  button: UiButton,
};

export type ComponentType = keyof typeof componentRegistry;

export function resolveComponent(type?: string) {
  if (!type) return null;
  return componentRegistry[type] || null;
}


