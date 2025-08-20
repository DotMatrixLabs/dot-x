import InputText from './InputText.vue';
import InputNumber from './InputNumber.vue';
import OptionSelect from './OptionSelect.vue';
import NumberSelect from './NumberSelect.vue';
import Toggle from './Toggle.vue';
import ActionButton from './ActionButton.vue';
import ActionLink from './ActionLink.vue';
import TextDisplay from './TextDisplay.vue';
import PasswordInput from './PasswordInput.vue';
import DateTimePicker from './DateTimePicker.vue';
import IPInput from './IPInput.vue';
import MacAddressInput from './MacAddressInput.vue';
import SortableArray from './SortableArray.vue';
import TimezoneSelect from './TimezoneSelect.vue';

// Cohesive naming scheme for API component types
// Keys are stable identifiers used in plugin settings schema
export const componentRegistry: Record<string, any> = {
  // Inputs
  text: InputText,
  number: InputNumber,
  password_pin: PasswordInput,

  // Selectors
  select: OptionSelect,
  number_select: NumberSelect,
  timezone_select: TimezoneSelect,

  // Toggles / switches
  toggle: Toggle,

  // Actions
  button: ActionButton,
  link: ActionLink,

  // Display-only
  display_text: TextDisplay,

  // Specialized inputs
  datetime: DateTimePicker,
  ip_address: IPInput,
  mac_address: MacAddressInput,
  array_sortable: SortableArray,
};

export type ComponentType = keyof typeof componentRegistry;

export function resolveComponent(type?: string) {
  if (!type) return null;
  return componentRegistry[type] || null;
}

