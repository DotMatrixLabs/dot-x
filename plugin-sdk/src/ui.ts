import type { SettingsSections, InputField, ButtonField, SwitchField, SettingsComponent, TextField, BadgeField, SystemUtilButton, ActionMappings } from './types';

export type UISection = { title: string; components: SettingsComponent[] };

/**
 * Chainable builder for constructing a SettingsSchema imperatively.
 *
 * Notes:
 * - Sections are represented by assigning the `section` property on subsequent fields.
 * - Button callbacks are preserved on the schema; the client will replace them with
 *   actionIds and register the callbacks during `settings.createSettings`.
 */
export class SettingsBuilder {
  private currentSection: string | undefined;
  private sections: UISection[] = [];
  private onMutate?: () => void;
  // Gate notifications so initial setup doesn't emit changes
  private notificationsEnabled = false;

  constructor(onMutate?: () => void) {
    this.onMutate = onMutate;
  }

  /**
   * Starts a new logical section. Subsequent fields will be assigned this section.
   */
  addSection(title: string): this {
    this.currentSection = title;
    // Ensure a section record exists and track keys in insertion order
    if (!this.sections.find((s) => s.title === title)) {
      this.sections.push({ title, components: [] });
    }
    return this;
  }

  /**
   * Adds a text-like field (defaults to 'text') and returns a chainable handle for it.
   *
   * You can override the input type by passing `options.type` with one of:
   * 'text' | 'password' | 'textarea' | 'color' | 'file' | 'number'.
   */
  addInput(key: string, options: Partial<InputField> = {}): InputFieldHandle {
    const allowedTypes: InputField['type'][] = ['text', 'password', 'textarea', 'color', 'file', 'number', 'ip_address', 'mac_address'];
    const chosenType = (options.type && allowedTypes.includes(options.type)) ? options.type : 'text';

    const field: InputField = {
      type: chosenType,
      label: options.label ?? '',
      ...options,
    } as InputField;

    const section = this.ensureCurrentSection();
    const component: SettingsComponent = { key, ...(field as any) };
    section.components.push(component);
    return new InputFieldHandle(component, this.createNotifier());
  }

  /**
   * Adds a button field with a click handler.
   */
  addButton(key: string): ButtonFieldHandle {
    const field: ButtonField = {
      type: 'button',
      label: '',
      text: '',
      style: 'primary',
      buttonTitle: 'Apply',
    } as ButtonField;

    const section = this.ensureCurrentSection();
    const component: SettingsComponent = { key, ...(field as any) };
    section.components.push(component);
    return new ButtonFieldHandle(component, this.createNotifier());
  }


  /**
   * Adds a switch field.
   */
  addSwitch(key: string): SwitchFieldHandle {
    const field: SwitchField = {
      type: 'switch',
      label: '',
    } as SwitchField;

    const section = this.ensureCurrentSection();
    const component: SettingsComponent = { key, ...(field as any) };
    section.components.push(component);
    return new SwitchFieldHandle(component, this.createNotifier());
  }

  /**
   * Adds a display-only text field.
   */
  addText(key: string): TextFieldHandle {
    const field: TextField = {
      type: 'text_display',
      label: '',
      text: '',
      style: 'default',
    } as TextField;

    const section = this.ensureCurrentSection();
    const component: SettingsComponent = { key, ...(field as any) };
    section.components.push(component);
    return new TextFieldHandle(component, this.createNotifier());
  }

  /**
   * Adds a display badge field.
   */
  addBadge(key: string): BadgeFieldHandle {
    const field: BadgeField = {
      type: 'badge',
      label: '',
      text: '',
      style: 'default',
    } as BadgeField;

    const section = this.ensureCurrentSection();
    const component: SettingsComponent = { key, ...(field as any) };
    section.components.push(component);
    return new BadgeFieldHandle(component, this.createNotifier());
  }
  /**
   * Returns the constructed SettingsSchema.
   */
  build(): SettingsSections {
    return { sections: this.sections.map((s) => ({ title: s.title, components: s.components })) };
  }

  /**
   * Ensure a current section exists or create a default one.
   */
  private ensureCurrentSection(): UISection {
    if (!this.currentSection) {
      // Create an implicit default section when none is selected
      this.addSection('General');
    }
    const section = this.sections.find((s) => s.title === (this.currentSection as string));
    if (!section) {
      // Fallback (should not happen due to addSection above)
      const fallback: UISection = { title: this.currentSection as string, components: [] };
      this.sections.push(fallback);
      return fallback;
    }
    return section;
  }

  /**
   * Turns on mutation notifications for subsequently updated handles.
   * Call this after the initial schema has been built and set.
   */
  enableNotifications(): void {
    this.notificationsEnabled = true;
  }

  /**
   * Provides a notifier that only forwards when notifications are enabled.
   */
  private createNotifier(): () => void {
    return () => {
      if (this.notificationsEnabled) {
        this.onMutate?.();
      }
    };
  }
}

/**
 * Builder for Slider Action modal content (System Utilities tab).
 * Allows plugins to register action buttons shown alongside built-in utilities.
 */
export class ActionMapper {
  private buttons: SystemUtilButton[] = [];
  private onMutate?: () => void;
  private notificationsEnabled = false;

  constructor(onMutate?: () => void) {
    this.onMutate = onMutate;
  }

  addSystemUtilButton(id: string): SystemUtilButtonHandle {
    const btn: SystemUtilButton = { id, title: '' };
    this.buttons.push(btn);
    return new SystemUtilButtonHandle(btn, this.createNotifier());
  }

  build(): ActionMappings {
    return { buttons: this.buttons.map(b => ({ ...b })) };
  }

  enableNotifications(): void {
    this.notificationsEnabled = true;
  }

  private createNotifier(): () => void {
    return () => {
      if (this.notificationsEnabled) {
        this.onMutate?.();
      }
    };
  }
}

class SystemUtilButtonHandle {
  constructor(private button: SystemUtilButton, private notifyChange?: () => void) {}

  setTitle(title: string): this {
    this.button.title = title;
    this.notifyChange?.();
    return this;
  }

  setIcon(icon: string): this {
    this.button.icon = icon;
    this.notifyChange?.();
    return this;
  }

  onClick(handler: () => void): this {
    this.button.onClick = handler;
    this.notifyChange?.();
    return this;
  }

  // Overload: set a single channel's selection
  setSelected(selected: boolean, channel: number | string): this;
  // Overload: set defaults for multiple channels using an array (index = channel)
  setSelected(defaults: boolean[]): this;
  // Overload: set defaults for multiple channels using a map
  setSelected(defaults: Record<string | number, boolean>): this;
  setSelected(
    selectedOrMap: boolean | boolean[] | Record<string | number, boolean>,
    channel?: number | string
  ): this {
    if (Array.isArray(selectedOrMap)) {
      // Replace the entire per-channel map using array indices
      const map: Record<string, boolean> = {};
      for (let i = 0; i < selectedOrMap.length; i++) {
        const v = !!selectedOrMap[i];
        if (v) {
          map[String(i)] = true;
        }
      }
      this.button.selectedByChannel = map;
      this.notifyChange?.();
      return this;
    }

    if (typeof selectedOrMap === 'object') {
      // Replace the entire per-channel map from provided object
      const map: Record<string, boolean> = {};
      for (const k in selectedOrMap) {
        if (Object.prototype.hasOwnProperty.call(selectedOrMap, k)) {
          map[String(k)] = !!(selectedOrMap as Record<string | number, boolean>)[k];
        }
      }
      this.button.selectedByChannel = map;
      this.notifyChange?.();
      return this;
    }

    // Single channel update
    const key = String(channel as string | number);
    if (!this.button.selectedByChannel) {
      this.button.selectedByChannel = {} as Record<string, boolean>;
    }
    (this.button.selectedByChannel as Record<string, boolean>)[key] = !!selectedOrMap;
    this.notifyChange?.();
    return this;
  }
}

class InputFieldHandle {
  constructor(private component: SettingsComponent, private notifyChange?: () => void) {}

  setPlaceholder(placeholder: string): this {
    (this.component as any).placeholder = placeholder;
    this.notifyChange?.();
    return this;
    
  }

  setValue(value: any): this {
    (this.component as any).default = value;
    this.notifyChange?.();
    return this;
  }

  onChange(callback: (data: { value: any }) => void): this {
    (this.component as any).onChange = callback;
    this.notifyChange?.();
    return this;
  }

  setDesc(description: string): this {
    (this.component as any).description = description;
    this.notifyChange?.();
    return this;
  }

  setName(name: string): this {
    (this.component as any).label = name;
    this.notifyChange?.();
    return this;
  }

  setLabel(label: string): this {
    (this.component as any).label = label;
    this.notifyChange?.();
    return this;
  }

  setRequired(required: boolean): this {
    (this.component as any).required = required;
    this.notifyChange?.();
    return this;
  }

  setDisabled(disabled: boolean): this {
    (this.component as any).disabled = disabled;
    this.notifyChange?.();
    return this;
  }

  setType(type: InputField['type']): this {
    (this.component as any).type = type;
    this.notifyChange?.();
    return this;
  }

  //Assign is used to bulk assign properties to the field eg. button.assign({ label: 'Username', placeholder: 'Enter username', required: true });
  assign(props: Partial<InputField>): this {
    Object.assign(this.component as any, props);
    this.notifyChange?.();
    return this;
  }

  setMax(max: number): this {
    (this.component as any).max = max;
    this.notifyChange?.();
    return this;
  }

  setMin(min: number): this {
    (this.component as any).min = min;
    this.notifyChange?.();
    return this;
  }
}

class ButtonFieldHandle {
  constructor(private component: SettingsComponent, private notifyChange?: () => void) {}

  //Title is the text that appears on the button
  setTitle(title: string): this {
    (this.component as any).buttonTitle = title;
    this.notifyChange?.();
    return this;
  }

  //Label is the text that appears next to the button
  setLabel(label: string): this {
    (this.component as any).label = label;
    this.notifyChange?.();
    return this;
  }

  //Style is the style of the button (primary, secondary, danger, outline)
  setStyle(style: ButtonField['style']): this {
    (this.component as any).style = style;
    this.notifyChange?.();
    return this;
  }

  //OnClick is the function that is called when the button is clicked
  onClick(onClick: () => void): this {
    (this.component as any).onClick = onClick;
    this.notifyChange?.();
    return this;
  }

  //Description is the description of the button, it appears below the label
  setDesc(description: string): this {
    (this.component as any).description = description;
    this.notifyChange?.();
    return this;
  }

  assign(props: Partial<ButtonField>): this {
    Object.assign(this.component as any, props);
    this.notifyChange?.();
    return this;
  }
}

class SwitchFieldHandle {
  constructor(private component: SettingsComponent, private notifyChange?: () => void) {}

  setValue(value: boolean): this {
    (this.component as any).default = value;
    this.notifyChange?.();
    return this;
  }

  onChange(callback: (data: { value: boolean }) => void): this {
    (this.component as any).onChange = callback;
    this.notifyChange?.();
    return this;
  }


  setLabel(label: string): this {
    (this.component as any).label = label;
    this.notifyChange?.();
    return this;
  }

  setDesc(description: string): this {
    (this.component as any).description = description;
    this.notifyChange?.();
    return this;
  }

  setRequired(required: boolean): this {
    (this.component as any).required = required;
    this.notifyChange?.();
    return this;
  }

  setDisabled(disabled: boolean): this {
    (this.component as any).disabled = disabled;
    this.notifyChange?.();
    return this;
  }

  assign(props: Partial<SwitchField>): this {
    Object.assign(this.component as any, props);
    this.notifyChange?.();
    return this;
  }
}

class TextFieldHandle {
  constructor(private component: SettingsComponent, private notifyChange?: () => void) {}

  setText(text: string): this {
    (this.component as any).text = text;
    this.notifyChange?.();
    return this;
  }

  setStyle(style: TextField['style']): this {
    (this.component as any).style = style;
    this.notifyChange?.();
    return this;
  }

  setLabel(label: string): this {
    (this.component as any).label = label;
    this.notifyChange?.();
    return this;
  }

  setDesc(description: string): this {
    (this.component as any).description = description;
    this.notifyChange?.();
    return this;
  }

  assign(props: Partial<TextField>): this {
    Object.assign(this.component as any, props);
    this.notifyChange?.();
    return this;
  }
}

class BadgeFieldHandle {
  constructor(private component: SettingsComponent, private notifyChange?: () => void) {}

  setText(text: string): this {
    (this.component as any).text = text;
    this.notifyChange?.();
    return this;
  }

  setStyle(style: BadgeField['style']): this {
    (this.component as any).style = style;
    this.notifyChange?.();
    return this;
  }

  setLabel(label: string): this {
    (this.component as any).label = label;
    this.notifyChange?.();
    return this;
  }

  setDesc(description: string): this {
    (this.component as any).description = description;
    this.notifyChange?.();
    return this;
  }

  assign(props: Partial<BadgeField>): this {
    Object.assign(this.component as any, props);
    this.notifyChange?.();
    return this;
  }
}



/**
 * Convenience factory for a new SettingsBuilder
 */
export function createSettingsBuilder(): SettingsBuilder {
  return new SettingsBuilder();
}

export function createActionMapper(): ActionMapper {
  return new ActionMapper();
}


