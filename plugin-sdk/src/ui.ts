import type { SettingsSections, TextField, ButtonField, SettingsComponent } from './types';

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
  addText(key: string, options: Partial<TextField> = {}): TextFieldHandle {
    const allowedTypes: TextField['type'][] = ['text', 'password', 'textarea', 'color', 'file', 'number'];
    const chosenType = (options.type && allowedTypes.includes(options.type)) ? options.type : 'text';

    const field: TextField = {
      type: chosenType,
      label: options.label ?? '',
      ...options,
    } as TextField;

    const section = this.ensureCurrentSection();
    const component: SettingsComponent = { key, ...(field as any) };
    section.components.push(component);
    return new TextFieldHandle(component, this.createNotifier());
  }

  /**
   * Adds a button field with a click handler.
   */
  addButton(key: string): ButtonFieldHandle {
    const field: ButtonField = {
      type: 'button',
      label: '',
      text: '',
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

class TextFieldHandle {
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

  onChange(callback: (value: any) => void): this {
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

  setHelp(help: string): this {
    (this.component as any).help = help;
    this.notifyChange?.();
    return this;
  }

  setType(type: TextField['type']): this {
    (this.component as any).type = type;
    this.notifyChange?.();
    return this;
  }

  //Assign is used to bulk assign properties to the field eg. button.assign({ label: 'Username', placeholder: 'Enter username', required: true });
  assign(props: Partial<TextField>): this {
    Object.assign(this.component as any, props);
    this.notifyChange?.();
    return this;
  }
}

class ButtonFieldHandle {
  constructor(private component: SettingsComponent, private notifyChange?: () => void) {}

  //Title is the text that appears on the button
  setTitle(title: string): this {
    (this.component as any).title = title;
    // Ensure frontend-visible label is updated as well
    (this.component as any).label = title;
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
  setOnClick(onClick: () => void): this {
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

  onChange(callback: (value: boolean) => void): this {
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

  assign(props: Partial<SwitchField>): this {
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


