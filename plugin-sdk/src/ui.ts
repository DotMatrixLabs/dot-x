/**
 * Plugin SDK UI builders for constructing settings UIs and action mappings.
 *
 * This module exposes fluent builder APIs to define settings sections and components
 * (inputs, switches, selects, buttons, text, badges) as well as action mappings for
 * the System Utilities tab. The output schemas are consumed by the host app.
 *
 * The primary entry points are {@link SettingsBuilder} and {@link ActionMapper}.
 * Prefer the convenience factories {@link createSettingsBuilder} and {@link createActionMapper}.
 *
 * @module ui
 */
import type { SettingsSections, InputField, ButtonField, SwitchField, SelectField, SettingsComponent, TextField, BadgeField, SystemUtilButton, ActionMappings } from './types';

/**
 * Minimal config store interface used for persisting small key/value maps.
 * Implementations typically wrap application configuration storage.
 * 
 * @internal
 */
type SimpleConfig = {
  set: (key: string | Record<string, any>, value?: any) => void;
  get: <T = any>(key: string, defaultValue?: T) => T | undefined;
  delete: (key: string) => void;
};

/**
 * Declarative description of a settings section containing UI components.
 * 
 * @category Settings Page
 * @category Action Mapper Modal
 *
 * @property {string} key - Stable identifier for the section.
 * @property {string} [name] - Human-readable section name; shown in UI.
 * @property {string} [title] - Deprecated alias for name maintained for back-compat.
 * @property {boolean} [disabled] - If true, section is rendered but inactive.
 * @property {boolean} [hidden] - If true, section is not shown.
 * @property {boolean} [expandable] - If true, section can be collapsed/expanded.
 * @property {boolean} [expanded] - Default expanded state when expandable.
 * @property {SettingsComponent[]} components - Fields/components within the section.
 */
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
 * Chainable builder for constructing plugin settings UI.
 * 
 * The SettingsBuilder provides a fluent API for creating settings pages with sections
 * and various UI components. All methods return handles that support method chaining.
 * 
 * @category Settings Page
 *
 * ## Available UI Components
 * 
 * | Component | Method | Description |
 * |-----------|--------|-------------|
 * | Section | `addSection(key)` | Creates a container for grouping related settings |
 * | Input | `addInput(key)` | Text input field (supports text, password, number, IP address, etc.) |
 * | Switch | `addSwitch(key)` | Toggle switch for boolean values |
 * | Button | `addButton(key)` | Clickable button that triggers actions |
 * | Select | `addSelect(key)` | Dropdown menu for selecting from options |
 * | Text | `addText(key)` | Read-only text display with styling |
 * | Badge | `addBadge(key)` | Status badge with colored styling |
 * 
 * @example
 * ```typescript
 * // Create a complete settings page
 * await this.createSettingsPage((settings) => {
 *   // Add a general settings section
 *   settings.addSection('general')
 *     .setName('General Settings')
 *     .setExpandable(false);
 *   
 *   // Add various input types
 *   settings.addInput('brokerIP')
 *     .setType('ip_address')
 *     .setLabel('Broker IP Address')
 *     .setPlaceholder('192.168.1.1')
 *     .setValue('127.0.0.1')
 *     .setRequired(true)
 *     .onChange(({ value }) => {
 *       this.config.set('brokerIP', value);
 *     });
 *   
 *   settings.addInput('port')
 *     .setType('number')
 *     .setLabel('Port')
 *     .setValue(1883)
 *     .setMin(1)
 *     .setMax(65535);
 *   
 *   // Add a switch
 *   settings.addSwitch('enableDebug')
 *     .setLabel('Enable Debug Mode')
 *     .setValue(false)
 *     .onChange(({ value }) => {
 *       console.log('Debug mode:', value);
 *     });
 *   
 *   // Add a select dropdown
 *   settings.addSelect('quality')
 *     .setLabel('Quality')
 *     .setOptions([
 *       { value: 'low', label: 'Low' },
 *       { value: 'medium', label: 'Medium' },
 *       { value: 'high', label: 'High' }
 *     ])
 *     .setValue('medium');
 *   
 *   // Add a button
 *   settings.addButton('testConnection')
 *     .setTitle('Test Connection')
 *     .setStyle('primary')
 *     .onClick(() => {
 *       this.ui.showToast({ message: 'Testing connection...', type: 'info' });
 *     });
 *   
 *   // Add display elements
 *   settings.addText('status')
 *     .setLabel('Connection Status')
 *     .setText('Connected')
 *     .setStyle('success');
 *   
 *   settings.addBadge('version')
 *     .setLabel('Version')
 *     .setText('1.0.0')
 *     .setStyle('info');
 *   
 *   // Add an expandable advanced section
 *   settings.addSection('advanced')
 *     .setName('Advanced Settings')
 *     .setExpandable(true)
 *     .setExpanded(false);
 * });
 * ```
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
   * Creates or selects a settings section.
   * 
   * Sections group related settings together. Use the returned handle to configure
   * section properties like name, expandability, and visibility.
   * 
   * @category Settings Page
   * @category Action Mapper Modal
   *
   * @param key - Unique identifier for the section
   * @returns Handle for configuring the section
   * 
   * ## SectionHandle Methods
   * 
   * | Method | Parameters | Description |
   * |--------|------------|-------------|
   * | `setName(name)` | `name: string` | Sets the display name shown in the UI |
   * | `setDisabled(disabled)` | `disabled: boolean` | Disables all controls in the section |
   * | `setHidden(hidden)` | `hidden: boolean` | Hides the section from view |
   * | `setExpandable(expandable)` | `expandable: boolean` | Makes section collapsible/expandable |
   * | `setExpanded(expanded)` | `expanded: boolean` | Sets default expanded state |
   * 
   * @example
   * ```typescript
   * // Create a basic section
   * settings.addSection('general')
   *   .setName('General Settings');
   * 
   * // Create an expandable section
   * settings.addSection('advanced')
   *   .setName('Advanced Settings')
   *   .setExpandable(true)
   *   .setExpanded(false);
   * 
   * // Create a hidden section (can be shown programmatically)
   * const debugSection = settings.addSection('debug')
   *   .setName('Debug Options')
   *   .setHidden(true);
   * 
   * // Show/hide sections dynamically
   * settings.addSwitch('showDebug')
   *   .setLabel('Show Debug Options')
   *   .onChange(({ value }) => {
   *     debugSection.setHidden(!value);
   *   });
   * ```
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
   * Adds an input field for text, numbers, passwords, and more.
   * 
   * @category Settings Page
   * @category Action Mapper Modal
   *
   * @param key - Unique identifier for the input field
   * @param options - Optional initial configuration
   * @returns Handle for configuring the input field
   * 
   * ## InputFieldHandle Methods
   * 
   * | Method | Parameters | Required | Description |
   * |--------|------------|----------|-------------|
   * | `setType(type)` | `'text' \| 'password' \| 'textarea' \| 'color' \| 'file' \| 'number' \| 'ip_address' \| 'mac_address'` | No | Sets the input type |
   * | `setLabel(label)` | `string` | No | Sets the field label |
   * | `setPlaceholder(text)` | `string` | No | Sets placeholder text |
   * | `setValue(value)` | `any` | No | Sets the default/current value |
   * | `setRequired(required)` | `boolean` | No | Marks field as required |
   * | `setDesc(description)` | `string` | No | Sets help text below the field |
   * | `setDisabled(disabled)` | `boolean` | No | Disables the input |
   * | `setMin(min)` | `number` | No | Sets minimum value (number type only) |
   * | `setMax(max)` | `number` | No | Sets maximum value (number type only) |
   * | `onChange(callback)` | `(data: { value: any }) => void` | No | Called when value changes |
   * | `assign(props)` | `Partial<InputField>` | No | Bulk assign multiple properties |
   * 
   * @example
   * ```typescript
   * // Text input
   * settings.addInput('username')
   *   .setLabel('Username')
   *   .setPlaceholder('Enter your username')
   *   .setValue('admin')
   *   .setRequired(true)
   *   .onChange(({ value }) => {
   *     console.log('Username changed:', value);
   *   });
   * 
   * // Password input
   * settings.addInput('password')
   *   .setType('password')
   *   .setLabel('Password')
   *   .setRequired(true);
   * 
   * // Number input with min/max
   * settings.addInput('port')
   *   .setType('number')
   *   .setLabel('Port Number')
   *   .setValue(8080)
   *   .setMin(1)
   *   .setMax(65535);
   * 
   * // IP Address input with validation
   * settings.addInput('serverIP')
   *   .setType('ip_address')
   *   .setLabel('Server IP')
   *   .setValue('192.168.1.1')
   *   .setDesc('Enter a valid IPv4 address');
   * 
   * // Textarea for long text
   * settings.addInput('notes')
   *   .setType('textarea')
   *   .setLabel('Notes')
   *   .setPlaceholder('Enter any additional notes...');
   * ```
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
   * Adds a clickable button to the settings page.
   * 
   * @category Settings Page
   * @category Action Mapper Modal
   *
   * @param key - Unique identifier for the button
   * @returns Handle for configuring the button
   * 
   * ## ButtonFieldHandle Methods
   * 
   * | Method | Parameters | Required | Description |
   * |--------|------------|----------|-------------|
   * | `setTitle(title)` | `string` | Yes | Sets the text shown on the button |
   * | `setLabel(label)` | `string` | No | Sets the label text beside the button |
   * | `setStyle(style)` | `'primary' \| 'secondary' \| 'danger'` | No | Sets the button style/color |
   * | `setDesc(description)` | `string` | No | Sets help text below the button |
   * | `onClick(callback)` | `() => void` | No | Called when button is clicked |
   * | `assign(props)` | `Partial<ButtonField>` | No | Bulk assign multiple properties |
   * 
   * @example
   * ```typescript
   * // Primary action button
   * settings.addButton('save')
   *   .setTitle('Save Settings')
   *   .setStyle('primary')
   *   .onClick(() => {
   *     this.config.set('lastSaved', Date.now());
   *     this.ui.showToast({ message: 'Settings saved!', type: 'success' });
   *   });
   * 
   * // Secondary button with label
   * settings.addButton('refresh')
   *   .setLabel('Connection')
   *   .setTitle('Refresh')
   *   .setStyle('secondary')
   *   .setDesc('Refresh the connection status')
   *   .onClick(() => {
   *     console.log('Refreshing connection...');
   *   });
   * 
   * // Danger button for destructive actions
   * settings.addButton('reset')
   *   .setTitle('Reset to Defaults')
   *   .setStyle('danger')
   *   .onClick(() => {
   *     this.config.clear();
   *     this.ui.showToast({ message: 'Settings reset', type: 'warning' });
   *   });
   * ```
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
   * Adds a toggle switch for boolean values.
   * 
   * @category Settings Page
   * @category Action Mapper Modal
   *
   * @param key - Unique identifier for the switch
   * @returns Handle for configuring the switch
   * 
   * ## SwitchFieldHandle Methods
   * 
   * | Method | Parameters | Required | Description |
   * |--------|------------|----------|-------------|
   * | `setLabel(label)` | `string` | Yes | Sets the switch label |
   * | `setValue(value)` | `boolean` | No | Sets the default/current state (on/off) |
   * | `setDesc(description)` | `string` | No | Sets help text below the switch |
   * | `setRequired(required)` | `boolean` | No | Marks the switch as required |
   * | `setDisabled(disabled)` | `boolean` | No | Disables the switch |
   * | `onChange(callback)` | `(data: { value: boolean }) => void` | No | Called when switch is toggled |
   * | `assign(props)` | `Partial<SwitchField>` | No | Bulk assign multiple properties |
   * 
   * @example
   * ```typescript
   * // Basic switch
   * settings.addSwitch('enableFeature')
   *   .setLabel('Enable Feature')
   *   .setValue(true)
   *   .onChange(({ value }) => {
   *     this.config.set('featureEnabled', value);
   *     console.log('Feature enabled:', value);
   *   });
   * 
   * // Switch with description
   * settings.addSwitch('debug')
   *   .setLabel('Debug Mode')
   *   .setValue(false)
   *   .setDesc('Enable detailed logging for troubleshooting')
   *   .onChange(({ value }) => {
   *     this.config.set('debug', value);
   *   });
   * 
   * // Switch that controls other elements
   * const advancedSwitch = settings.addSwitch('showAdvanced')
   *   .setLabel('Show Advanced Settings')
   *   .setValue(false)
   *   .onChange(({ value }) => {
   *     advancedSection.setHidden(!value);
   *   });
   * ```
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
   * Adds a dropdown select menu with options.
   * 
   * @category Settings Page
   * @category Action Mapper Modal
   *
   * @param key - Unique identifier for the select field
   * @param options - Optional initial configuration
   * @returns Handle for configuring the select field
   * 
   * ## SelectFieldHandle Methods
   * 
   * | Method | Parameters | Required | Description |
   * |--------|------------|----------|-------------|
   * | `setLabel(label)` | `string` | Yes | Sets the field label |
   * | `setPlaceholder(text)` | `string` | No | Sets placeholder text |
   * | `setOptions(options)` | `Array<{ value: any, label: string }> \| Array<string \| number>` | Yes | Sets the selectable options |
   * | `setValue(value)` | `any` | No | Sets the default selected value |
   * | `setDesc(description)` | `string` | No | Sets help text below the field |
   * | `setRequired(required)` | `boolean` | No | Marks field as required |
   * | `setDisabled(disabled)` | `boolean` | No | Disables the select |
   * | `onChange(callback)` | `(data: { value: any }) => void` | No | Called when selection changes |
   * | `assign(props)` | `Partial<SelectField>` | No | Bulk assign multiple properties |
   * 
   * @example
   * ```typescript
   * // Basic select with object options
   * settings.addSelect('quality')
   *   .setLabel('Quality Level')
   *   .setPlaceholder('Choose quality...')
   *   .setOptions([
   *     { value: 'low', label: 'Low Quality' },
   *     { value: 'medium', label: 'Medium Quality' },
   *     { value: 'high', label: 'High Quality' }
   *   ])
   *   .setValue('medium')
   *   .onChange(({ value }) => {
   *     this.config.set('quality', value);
   *   });
   * 
   * // Select with simple array options
   * settings.addSelect('theme')
   *   .setLabel('Theme')
   *   .setOptions(['Light', 'Dark', 'Auto'])
   *   .setValue('Auto');
   * 
   * // Select with numeric options
   * settings.addSelect('retryCount')
   *   .setLabel('Retry Attempts')
   *   .setOptions([1, 3, 5, 10])
   *   .setValue(3)
   *   .setDesc('Number of times to retry on failure');
   * ```
   */
  addSelect(key: string, options: Partial<SelectField> = {}): SelectFieldHandle {
    const field: SelectField = {
      type: 'select',
      label: options.label ?? '',
      options: Array.isArray(options.options) ? options.options : [],
      ...options,
    } as SelectField;

    const section = this.ensureCurrentSection();
    const component: SettingsComponent = { key, ...(field as any) };
    section.components.push(component);
    return new SelectFieldHandle(component, this.createNotifier());
  }

  /**
   * Adds a read-only text display element.
   * 
   * @category Settings Page
   * @category Action Mapper Modal
   *
   * @param key - Unique identifier for the text element
   * @returns Handle for configuring the text display
   * 
   * ## TextFieldHandle Methods
   * 
   * | Method | Parameters | Required | Description |
   * |--------|------------|----------|-------------|
   * | `setLabel(label)` | `string` | No | Sets the label text |
   * | `setText(text)` | `string` | Yes | Sets the display text content |
   * | `setStyle(style)` | `'default' \| 'muted' \| 'info' \| 'success' \| 'warning' \| 'error'` | No | Sets the text color/style |
   * | `setDesc(description)` | `string` | No | Sets help text below the element |
   * | `assign(props)` | `Partial<TextField>` | No | Bulk assign multiple properties |
   * 
   * @example
   * ```typescript
   * // Display connection status
   * const statusText = settings.addText('connectionStatus')
   *   .setLabel('Status')
   *   .setText('Connected')
   *   .setStyle('success');
   * 
   * // Update text dynamically
   * setInterval(() => {
   *   const time = new Date().toLocaleTimeString();
   *   statusText.setText(time);
   * }, 1000);
   * 
   * // Info message
   * settings.addText('info')
   *   .setText('This plugin requires an active internet connection')
   *   .setStyle('info');
   * 
   * // Warning message
   * settings.addText('warning')
   *   .setText('Beta feature - use with caution')
   *   .setStyle('warning');
   * 
   * // Error message
   * settings.addText('error')
   *   .setText('Connection failed')
   *   .setStyle('error');
   * ```
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
   * Adds a status badge with colored styling.
   * 
   * @category Settings Page
   * @category Action Mapper Modal
   *
   * @param key - Unique identifier for the badge
   * @returns Handle for configuring the badge
   * 
   * ## BadgeFieldHandle Methods
   * 
   * | Method | Parameters | Required | Description |
   * |--------|------------|----------|-------------|
   * | `setLabel(label)` | `string` | No | Sets the label text |
   * | `setText(text)` | `string` | Yes | Sets the badge text content |
   * | `setStyle(style)` | `'default' \| 'muted' \| 'info' \| 'success' \| 'warning' \| 'error'` | No | Sets the badge color/style |
   * | `setDesc(description)` | `string` | No | Sets help text below the badge |
   * | `assign(props)` | `Partial<BadgeField>` | No | Bulk assign multiple properties |
   * 
   * @example
   * ```typescript
   * // Connection status badge
   * const connectionBadge = settings.addBadge('status')
   *   .setLabel('Connection')
   *   .setText('Connected')
   *   .setStyle('success');
   * 
   * // Update badge dynamically
   * function updateStatus(connected: boolean) {
   *   if (connected) {
   *     connectionBadge.setText('Connected').setStyle('success');
   *   } else {
   *     connectionBadge.setText('Disconnected').setStyle('error');
   *   }
   * }
   * 
   * // Version badge
   * settings.addBadge('version')
   *   .setLabel('Version')
   *   .setText('1.0.0')
   *   .setStyle('info');
   * 
   * // Status badges
   * settings.addBadge('beta')
   *   .setText('Beta')
   *   .setStyle('warning');
   * 
   * settings.addBadge('pro')
   *   .setText('Pro Feature')
   *   .setStyle('info');
   * ```
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
   * Builds and returns the constructed {@link SettingsSections} schema.
   *
   * @returns {SettingsSections}
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
   *
   * @returns {void}
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
 * Handle for configuring a settings section.
 * 
 * Provides methods to configure section properties like name, visibility, and expandability.
 * 
 * @displayName Section
 * @category Settings Page
 * @category Action Mapper Modal
 */
export class SectionHandle {
  constructor(private section: UISection, private notifyChange?: () => void) {}

  /**
   * Sets the name of the section.
   * 
   * @param name - The name of the section
   * @returns The SectionHandle for method chaining
   */
  setName(name: string): this {
    this.section.name = name;
    this.notifyChange?.();
    return this;
  }

  /**
   * Sets the disabled state of the section.
   * 
   * @param disabled - The disabled state of the section
   * @returns The SectionHandle for method chaining
   */
  setDisabled(disabled: boolean): this {
    this.section.disabled = disabled;
    this.notifyChange?.();
    return this;
  }

  /**
   * Sets the hidden state of the section.
   * 
   * 
   * @param hidden - The hidden state of the section
   * @returns The SectionHandle for method chaining
   */
  setHidden(hidden: boolean): this {
    this.section.hidden = hidden;
    this.notifyChange?.();
    return this;
  }

  /**
   * Sets the expandable state of the section.
   * When set to true, the section will render as an expandable section.
   * 
   * @param expandable - The expandable state of the section
   * @returns The SectionHandle for method chaining
   */
  setExpandable(expandable: boolean): this {
    this.section.expandable = expandable;
    this.notifyChange?.();
    return this;
  }

  /**
   * Sets the expanded state of the section. When set to true, the section will be expanded. When set to false, the section will be collapsed.
   * @param expanded - The expanded state of the section
   * @returns The SectionHandle for method chaining
   */
  setExpanded(expanded: boolean): this {
    this.section.expanded = expanded;
    this.notifyChange?.();
    return this;
  }
}

/**
 * Builder for creating System Utilities action buttons.
 * 
 * The ActionMapper allows plugins to register custom buttons in the System Utilities
 * modal. These buttons can be assigned to device channels (sliders, knobs, buttons) and
 * can have their own settings UI.
 * 
 * @category Action Mapper Modal
 * 
 * @example
 * ```typescript
 * // Create a simple action button
 * this.actionmapper
 *   .addSystemUtilButton('toggleMic')
 *   .setTitle('Mic Mute')
 *   .setIcon('fas fa-microphone fa-lg')
 *   .onClick(({ selected, channel }) => {
 *     console.log(`Mic ${selected ? 'muted' : 'unmuted'} on channel ${channel}`);
 *     // Call your MIDI/API to toggle mic
 *   });
 * 
 * // Action button with settings
 * const eqButton = this.actionmapper
 *   .addSystemUtilButton('equalizer')
 *   .setTitle('EQ')
 *   .setIcon('fas fa-sliders-h fa-lg')
 *   .onClick(({ selected, channel }) => {
 *     const settings = this.config.get(`eq.channel${channel}`);
 *     // Apply EQ settings
 *   });
 * 
 * // Add per-button settings
 * eqButton.addSettings((settings) => {
 *   settings.addSection('eq').setName('Equalizer Settings');
 *   
 *   settings.addSelect('preset')
 *     .setLabel('Preset')
 *     .setOptions(['Flat', 'Bass Boost', 'Treble Boost'])
 *     .setValue('Flat');
 *   
 *   settings.addSwitch('enabled')
 *     .setLabel('Enable EQ')
 *     .setValue(true);
 * });
 * ```
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

  /**
   * Creates a new System Utilities action button.
   * 
   * System Utility buttons appear in the action selector modal and can be assigned
   * to device channels. Each button maintains its own selected state per channel.
   * 
   * @category Action Mapper Modal
   *
   * @param id - Unique identifier for the button
   * @returns Handle for configuring the button
   * 
   * ## SystemUtilButtonHandle Methods
   * 
   * | Method | Parameters | Required | Description |
   * |--------|------------|----------|-------------|
   * | `setTitle(title)` | `string` | Yes | Sets the button display title |
   * | `setIcon(icon)` | `string` | No | Sets FontAwesome icon class (e.g., 'fas fa-bolt fa-lg') |
   * | `onClick(callback)` | `({ selected: boolean, channel: number \| string }) => void` | Yes | Called when button is clicked/toggled |
   * | `addSettings(buildFn)` | `(builder: SettingsBuilder) => void` | No | Adds per-button settings UI |
   * | `setSelected(selected, channel)` | `boolean, number \| string` | No | Sets selected state for a specific channel |
   * | `setSelected(defaults)` | `boolean[] \| Record<string \| number, boolean>` | No | Sets default selected states for multiple channels |
   * | `getSelectedMap()` | - | - | Returns the per-channel selection map |
   * | `isSelected(channel)` | `number \| string` | - | Checks if button is selected on a channel |
   * | `setAutoPersist(flag)` | `boolean` | No | Controls automatic persistence of selection state |
   * 
   * @example
   * ```typescript
   * // Basic action button
   * this.actionmapper
   *   .addSystemUtilButton('mute')
   *   .setTitle('Mute')
   *   .setIcon('fas fa-volume-mute fa-lg')
   *   .onClick(({ selected, channel }) => {
   *     console.log(`Channel ${channel} mute ${selected ? 'ON' : 'OFF'}`);
   *     // Implement mute logic
   *   });
   * 
   * // Button with settings
   * const volumeButton = this.actionmapper
   *   .addSystemUtilButton('volume')
   *   .setTitle('Volume Control')
   *   .setIcon('fas fa-volume-up fa-lg');
   * 
   * volumeButton.addSettings((settings) => {
   *   settings.addSection('volume').setName('Volume Settings');
   *   
   *   settings.addInput('maxVolume')
   *     .setType('number')
   *     .setLabel('Maximum Volume')
   *     .setValue(100)
   *     .setMin(0)
   *     .setMax(100);
   *   
   *   settings.addSwitch('smoothing')
   *     .setLabel('Volume Smoothing')
   *     .setValue(true)
   *     .setDesc('Smoothly transition between volume levels');
   * });
   * ```
   */
  addSystemUtilButton(id: string): SystemUtilButtonHandle {
    const btn: SystemUtilButton = { id, title: '' };
    this.buttons.push(btn);
    return new SystemUtilButtonHandle(btn, this.createNotifier(), this.configStore);
  }


  /**
   * Builds and returns the action mappings for registered buttons.
   *
   * @returns {ActionMappings}
   */
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

  /**
   * Enables mutation notifications for nested handles.
   *
   * @returns {void}
   * @internal
   */
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

/**
 * Handle for configuring a System Utilities action button.
 * 
 * Returned by {@link ActionMapper.addSystemUtilButton}. Provides methods to configure
 * button properties, click handlers, selection state, and per-button settings.
 * 
 * @displayName System Util Button
 * @category Action Mapper Modal
 */
export class SystemUtilButtonHandle {
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
  /**
   * Checks if the button is selected on a specific channel.
   * @param channel - The channel to check
   * @returns True if the button is selected on the channel, false otherwise
   */ 
  isSelected(channel: number | string): boolean {
    const map = this.getSelectedMap();
    return !!map[String(channel)];
  }

  setAutoPersist(flag: boolean): this {
    this.autoPersist = !!flag;
    return this;
  }
}

/**
 * Handle for configuring an input field.
 * 
 * Returned by {@link SettingsBuilder.addInput}. Provides methods to configure
 * input properties like type, placeholder, value, validation, and change handlers.
 * 
 * @displayName Input Field
 * @category Settings Page
 * @category Action Mapper Modal
 */
export class InputFieldHandle {
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

/**
 * Handle for configuring a button field.
 * 
 * Returned by {@link SettingsBuilder.addButton}. Provides methods to configure
 * button properties like title, label, style, and click handlers.
 * 
 * @displayName Button Field
 * @category Settings Page
 * @category Action Mapper Modal
 */
export class ButtonFieldHandle {
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

/**
 * Handle for configuring a switch field.
 * 
 * Returned by {@link SettingsBuilder.addSwitch}. Provides methods to configure
 * switch properties like label, value, description, and change handlers.
 * 
 * @displayName Switch Field
 * @category Settings Page
 * @category Action Mapper Modal
 */
export class SwitchFieldHandle {
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

/**
 * Handle for configuring a text display field.
 * 
 * Returned by {@link SettingsBuilder.addText}. Provides methods to configure
 * text properties like label, text content, and style.
 * 
 * @displayName Text Field
 * @category Settings Page
 * @category Action Mapper Modal
 */
export class TextFieldHandle {
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

/**
 * Handle for configuring a badge display field.
 * 
 * Returned by {@link SettingsBuilder.addBadge}. Provides methods to configure
 * badge properties like label, text content, and style.
 * 
 * @displayName Badge Field
 * @category Settings Page
 * @category Action Mapper Modal
 */
export class BadgeFieldHandle {
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
 * Handle for configuring a select dropdown field.
 * 
 * Returned by {@link SettingsBuilder.addSelect}. Provides methods to configure
 * select properties like label, options, value, and change handlers.
 * 
 * @displayName Select Field
 * @category Settings Page
 * @category Action Mapper Modal
 */
export class SelectFieldHandle {
  constructor(private component: SettingsComponent, private notifyChange?: () => void) {}

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

  setOptions(options: Array<{ value: any; label: string }> | Array<string | number>): this {
    const normalized = Array.isArray(options)
      ? options.map((opt: any) =>
          typeof opt === 'object' && opt !== null && 'value' in opt && 'label' in opt
            ? opt
            : { value: opt, label: String(opt) }
        )
      : [];
    (this.component as any).options = normalized;
    this.notifyChange?.();
    return this;
  }

  onChange(callback: (data: { value: any }) => void): this {
    (this.component as any).onChange = callback;
    this.notifyChange?.();
    return this;
  }

  assign(props: Partial<SelectField>): this {
    Object.assign(this.component as any, props);
    this.notifyChange?.();
    return this;
  }
}



/**
 * Creates a new SettingsBuilder instance.
 * 
 * Factory function for creating a settings builder. Usually not needed as
 * `createSettingsPage()` provides this automatically.
 *
 * @category Settings Page
 * 
 * @returns New SettingsBuilder instance
 * 
 * @example
 * ```typescript
 * const builder = createSettingsBuilder();
 * builder.addSection('general');
 * builder.addInput('apiKey')
 *   .setLabel('API Key')
 *   .setType('password');
 * const schema = builder.build();
 * ```
 */
export function createSettingsBuilder(): SettingsBuilder {
  return new SettingsBuilder();
}

/**
 * Creates a new ActionMapper instance.
 * 
 * Factory function for creating an action mapper. Usually not needed as
 * the plugin class provides `this.actionmapper` automatically.
 *
 * @category Action Mapper Modal
 * 
 * @returns New ActionMapper instance
 * 
 * @example
 * ```typescript
 * const mapper = createActionMapper();
 * mapper.addSystemUtilButton('mute')
 *   .setTitle('Mute')
 *   .setIcon('fas fa-volume-mute fa-lg');
 * const actions = mapper.build();
 * ```
 */
export function createActionMapper(): ActionMapper {
  return new ActionMapper();
}


