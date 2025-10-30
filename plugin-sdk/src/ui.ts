import type { SettingsSections, InputField, ButtonField, SwitchField, SettingsComponent, TextField, BadgeField, SystemUtilButton, ActionMappings } from './types';

type SimpleConfig = {
  set: (key: string | Record<string, any>, value?: any) => void;
  get: <T = any>(key: string, defaultValue?: T) => T | undefined;
  delete: (key: string) => void;
};

export type UISection = {
  key: string;
  name?: string;
  title?: string; // back-compat display name
  disabled?: boolean;
  hidden?: boolean;
  expandable?: boolean;
  expanded?: boolean; // default collapsed unless true
  components: SettingsComponent[];
};

/**
 * Chainable builder for constructing a SettingsSchema imperatively.
 *
 * Notes:
 * - Sections are represented by assigning the `section` property on subsequent fields.
 * - Button callbacks are preserved on the schema; the client will replace them with
 *   actionIds and register the callbacks during `settings.createSettings`.
 */
export class SettingsBuilder {
  private currentSectionKey: string | undefined;
  private sections: UISection[] = [];
  private onMutate?: () => void;
  // Gate notifications so initial setup doesn't emit changes
  private notificationsEnabled = false;

  constructor(onMutate?: () => void) {
    this.onMutate = onMutate;
  }

  /**
   * Starts or selects a section by stable `key` and returns a SectionHandle to configure it.
   * Subsequent field additions will be assigned to this section.
   */
  addSection(key: string): SectionHandle {
    this.currentSectionKey = key;
    // Ensure a section record exists and track insertion order
    let section = this.sections.find((s) => s.key === key);
    if (!section) {
      section = { key, components: [] } as UISection;
      this.sections.push(section);
    }
    return new SectionHandle(section, this.createNotifier());
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
    return {
      sections: this.sections.map((s) => ({
        key: s.key,
        name: s.name,
        title: s.title,
        disabled: s.disabled,
        hidden: s.hidden,
        expandable: s.expandable,
        expanded: s.expanded,
        components: s.components,
      })),
    };
  }

  /**
   * Ensure a current section exists or create a default one.
   */
  private ensureCurrentSection(): UISection {
    if (!this.currentSectionKey) {
      // Create an implicit default section when none is selected
      this.addSection('general');
    }
    const section = this.sections.find((s) => s.key === (this.currentSectionKey as string));
    if (!section) {
      // Fallback (should not happen due to addSection above)
      const fallback: UISection = { key: this.currentSectionKey as string, components: [] } as UISection;
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

class SectionHandle {
  constructor(private section: UISection, private notifyChange?: () => void) {}

  setName(name: string): this {
    this.section.name = name;
    this.notifyChange?.();
    return this;
  }

  setDisabled(disabled: boolean): this {
    this.section.disabled = disabled;
    this.notifyChange?.();
    return this;
  }

  setHidden(hidden: boolean): this {
    this.section.hidden = hidden;
    this.notifyChange?.();
    return this;
  }

  setExpandable(expandable: boolean): this {
    this.section.expandable = expandable;
    this.notifyChange?.();
    return this;
  }

  setExpanded(expanded: boolean): this {
    this.section.expanded = expanded;
    this.notifyChange?.();
    return this;
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
  private configStore?: SimpleConfig;

  constructor(onMutate?: () => void, configStore?: SimpleConfig) {
    this.onMutate = onMutate;
    this.configStore = configStore;
  }

  addSystemUtilButton(id: string): SystemUtilButtonHandle {
    const btn: SystemUtilButton = { id, title: '' };
    this.buttons.push(btn);
    return new SystemUtilButtonHandle(btn, this.createNotifier(), this.configStore);
  }

  /**
   * Attach a SettingsSections schema to an existing SystemUtilButton by id.
   * Reuses SettingsBuilder so plugin authors can call addText/addSwitch/etc.
   */
  addSystemUtilSetting(buttonId: string, build: (b: SettingsBuilder) => void): this {
    const btn = this.buttons.find(b => b.id === buttonId);
    if (!btn) return this;
    const builder = new SettingsBuilder(() => {
      // Push updates when nested builder mutates
      btn.settings = builder.build();
      this.onMutate?.();
    });
    build(builder);
    btn.settings = builder.build();
    return this;
  }

  build(): ActionMappings {
    return {
      buttons: this.buttons.map((b) => {
        const copy: SystemUtilButton = { ...b } as SystemUtilButton;
        if (!copy.selectedByChannel && this.configStore) {
          const key = `action.${copy.id}.selectedByChannel`;
          copy.selectedByChannel = this.configStore.get<Record<string, boolean>>(key, {} as any) || {};
        }
        return copy;
      })
    };
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
  private autoPersist = true;
  private pluginClickHandler?: (evt: { selected: boolean; channel: number | string }) => void;

  constructor(private button: SystemUtilButton, private notifyChange?: () => void, private configStore?: SimpleConfig) {
    const storageKey = () => `action.${this.button.id}.selectedByChannel`;
    const getMap = (): Record<string, boolean> => {
      if (!this.configStore) return (this.button.selectedByChannel && { ...this.button.selectedByChannel }) || {};
      return this.configStore.get<Record<string, boolean>>(storageKey(), {} as any) || {};
    };
    const setMap = (map: Record<string, boolean>) => {
      if (this.configStore && this.autoPersist) this.configStore.set(storageKey(), map);
    };

    // Default click: toggle + persist, then call plugin handler if provided
    (this.button as any).onClick = (evt: any) => {
      const ch = evt && Object.prototype.hasOwnProperty.call(evt, 'channel') ? evt.channel : undefined;
      const selectedFromEvt = evt && Object.prototype.hasOwnProperty.call(evt, 'selected') ? evt.selected : undefined;
      if (ch === undefined || ch === null) {
        // Without a channel we cannot map selection; just invoke plugin handler if present
        if (typeof this.pluginClickHandler === 'function') {
          this.pluginClickHandler(evt);
        }
        return;
      }
      const channelKey = String(ch);
      const currentMap = getMap();
      const newSelected = typeof selectedFromEvt === 'boolean' ? !!selectedFromEvt : !currentMap[channelKey];

      const nextMap = { ...currentMap, [channelKey]: newSelected };
      setMap(nextMap);

      if (!this.button.selectedByChannel) this.button.selectedByChannel = {} as Record<string, boolean>;
      (this.button.selectedByChannel as Record<string, boolean>)[channelKey] = newSelected;
      this.notifyChange?.();

      if (typeof this.pluginClickHandler === 'function') {
        this.pluginClickHandler({ selected: newSelected, channel: ch });
      }
    };
  }

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

  onClick(handler: (evt: { selected: boolean; channel: number | string }) => void): this {
    this.pluginClickHandler = handler;
    this.notifyChange?.();
    return this;
  }

  /**
   * Fluent helper to attach per-button settings using SettingsBuilder.
   */
  addSettings(build: (b: SettingsBuilder) => void): this {
    const builder = new SettingsBuilder(() => {
      this.button.settings = builder.build();
      this.notifyChange?.();
    });
    build(builder);
    this.button.settings = builder.build();
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
    const storageKey = `action.${this.button.id}.selectedByChannel`;
    const getMap = (): Record<string, boolean> => {
      if (!this.configStore) return (this.button.selectedByChannel && { ...this.button.selectedByChannel }) || {};
      return this.configStore.get<Record<string, boolean>>(storageKey, {} as any) || {};
    };
    const setMap = (map: Record<string, boolean>) => {
      if (this.configStore && this.autoPersist) this.configStore.set(storageKey, map);
    };
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
      setMap(map);
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
      setMap(map);
      this.notifyChange?.();
      return this;
    }

    // Single channel update
    const key = String(channel as string | number);
    if (!this.button.selectedByChannel) {
      this.button.selectedByChannel = {} as Record<string, boolean>;
    }
    (this.button.selectedByChannel as Record<string, boolean>)[key] = !!selectedOrMap;
    const map = getMap();
    const nextMap = { ...map, [key]: !!selectedOrMap };
    setMap(nextMap);
    this.notifyChange?.();
    return this;
  }

  getSelectedMap(): Record<string, boolean> {
    if (this.configStore) {
      const key = `action.${this.button.id}.selectedByChannel`;
      return this.configStore.get<Record<string, boolean>>(key, {} as any) || {};
    }
    return (this.button.selectedByChannel && { ...this.button.selectedByChannel }) || {};
  }

  isSelected(channel: number | string): boolean {
    const map = this.getSelectedMap();
    return !!map[String(channel)];
  }

  setAutoPersist(flag: boolean): this {
    this.autoPersist = !!flag;
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


