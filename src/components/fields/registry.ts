// import InputText from './InputText.vue';
import Input from './Input.vue';
import Select from './Select.vue';
import NumberSelect from './NumberSelect.vue';
import Switch from './Switch.vue';
import ActionButton from './ActionButton.vue';
import ActionLink from './ActionLink.vue';
import TextDisplay from './TextDisplay.vue';
import Badge from './Badge.vue';
import Info from './Info.vue';
import PasswordInput from './PasswordInput.vue';
import DateTimePicker from './DateTimePicker.vue';
// import IPInput from './IPInput.vue';
import MacAddressInput from './MacAddressInput.vue';
import SortableArray from './SortableArray.vue';
import TimezoneSelect from './TimezoneSelect.vue';

// Cohesive naming scheme for API component types
// Keys are stable identifiers used in plugin settings schema
export const componentRegistry: Record<string, any> = {
  // Inputs

  input: Input,
  text: Input,
  number: Input,
  password_pin: PasswordInput,

  // Selectors
  select: Select,
  number_select: NumberSelect,
  timezone_select: TimezoneSelect,

  // Toggles / switches
  switch: Switch,

  // Actions
  button: ActionButton,
  link: ActionLink,

  // Display-only
  text_display: TextDisplay,
  badge: Badge,
  info: Info,

  // Specialized inputs
  datetime: DateTimePicker,
  ip_address: Input,
  mac_address: MacAddressInput,
  array_sortable: SortableArray,
};

export type ComponentType = keyof typeof componentRegistry;

export function resolveComponent(type?: string) {
  if (!type) return null;
  return componentRegistry[type] || null;
}

