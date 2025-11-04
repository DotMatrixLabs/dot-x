// Uses registry.ts as source of truth for component resolution
// Defines base props and example-specific props for docs generation

export const COMPONENT_METADATA = {
  input: {
    registryKey: 'input',
    baseProps: { type: 'text' },
    category: 'form',
    docs: {
      title: 'Input Field',
      description: 'Single-line text input field',
      examples: {
        basic: { 
          label: 'Username', 
          placeholder: 'Enter username', 
          value: '',
          description: 'Basic text input with placeholder'
        },
        required: { 
          label: 'Email', 
          placeholder: 'email@example.com', 
          required: true,
          description: 'Required field that must be filled',
          help: 'Please enter a valid email address'
        },
        disabled: { 
          label: 'Account ID', 
          value: 'admin',
          disabled: true,
          description: 'Disabled input that cannot be edited'
        },
        'with-length-limits': { 
          label: 'Product Code', 
          placeholder: 'ABC-123',
          min: 3,
          max: 10,
          description: 'Input with min/max length validation',
          help: 'Between 3 and 10 characters'
        }
      }
    }
  },
  text: {
    registryKey: 'text',
    baseProps: { type: 'text' },
    category: 'form',
    docs: {
      title: 'Text Input',
      description: 'Text input field (alias for input)',
      examples: {
        basic: { 
          label: 'Full Name', 
          placeholder: 'Enter your full name', 
          value: '',
          description: 'Simple text input field'
        },
        'with-help': {
          label: 'Organization',
          placeholder: 'Company or team name',
          description: 'Text input with help text',
          help: 'Enter your company or organization name'
        },
        required: {
          label: 'Display Name',
          placeholder: 'How should we address you?',
          required: true,
          description: 'Required text field'
        },
        disabled: {
          label: 'Username',
          value: 'john_doe',
          disabled: true,
          description: 'Read-only disabled field'
        }
      }
    }
  },
  number: {
    registryKey: 'number',
    baseProps: { type: 'number' },
    category: 'form',
    docs: {
      title: 'Number Input',
      description: 'Numeric input with validation',
      examples: {
        basic: { 
          label: 'Age', 
          value: 25,
          placeholder: 'Enter age',
          description: 'Basic number input'
        },
        'with-min-max': { 
          label: 'Port Number', 
          value: 8080, 
          min: 1, 
          max: 65535,
          placeholder: '1-65535',
          description: 'Number input with min/max range validation',
          help: 'Valid port range: 1-65535'
        },
        'with-step': {
          label: 'Temperature',
          value: 20.5,
          step: 0.5,
          min: -50,
          max: 50,
          description: 'Number input with decimal step increment',
          help: 'Adjustable in 0.5 degree increments'
        },
        required: { 
          label: 'Quantity', 
          required: true,
          placeholder: 'Enter quantity',
          min: 1,
          description: 'Required number field with minimum value'
        }
      }
    }
  },
  ip_address: {
    registryKey: 'ip_address',
    baseProps: { type: 'ip_address' },
    category: 'form',
    docs: {
      title: 'IP Address Input',
      description: 'IP address input with validation',
      examples: {
        basic: { 
          label: 'Server IP', 
          placeholder: '192.168.1.1', 
          value: '',
          description: 'Basic IP address input',
          help: 'Enter IPv4 address or hostname'
        },
        gateway: { 
          label: 'Default Gateway', 
          placeholder: '192.168.0.1',
          value: '192.168.1.1',
          description: 'Gateway IP configuration',
          help: 'Router or gateway IP address'
        },
        dns: {
          label: 'DNS Server',
          placeholder: '8.8.8.8',
          description: 'DNS server IP address',
          help: 'Primary DNS server (e.g., 8.8.8.8 for Google DNS)'
        },
        required: {
          label: 'Static IP Address',
          placeholder: '10.0.0.0',
          required: true,
          description: 'Required IP address field',
          help: 'Must be a valid IPv4 address'
        }
      }
    }
  },
  select: {
    registryKey: 'select',
    baseProps: {},
    category: 'form',
    docs: {
      title: 'Select Field',
      description: 'Dropdown selection field',
      examples: {
        basic: { 
          label: 'Country', 
          options: ['USA', 'UK', 'Canada', 'Australia'], 
          value: 'USA',
          description: 'Basic select with simple string array options'
        },
        'object-options': { 
          label: 'Video Quality',
          options: [
            { value: 'low', label: 'Low Quality (480p)' },
            { value: 'medium', label: 'Medium Quality (720p)' },
            { value: 'high', label: 'High Quality (1080p)' },
            { value: 'ultra', label: 'Ultra Quality (4K)' }
          ],
          value: 'medium',
          description: 'Select with object options (value/label pairs)',
          help: 'Higher quality requires more bandwidth'
        },
        required: { 
          label: 'Region', 
          options: ['North America', 'Europe', 'Asia Pacific', 'South America'], 
          required: true,
          placeholder: 'Select your region',
          description: 'Required select with placeholder for unselected state',
          help: 'Please select your geographic region'
        },
        disabled: { 
          label: 'Account Type', 
          options: ['Free', 'Premium', 'Enterprise'], 
          value: 'Premium', 
          disabled: true,
          description: 'Disabled select that cannot be changed'
        }
      }
    }
  },
  number_select: {
    registryKey: 'number_select',
    baseProps: {},
    category: 'form',
    docs: {
      title: 'Number Select',
      description: 'Dropdown for numeric values',
      examples: {
        'with-seconds-unit': { 
          label: 'Timeout Duration',
          min: 5,
          max: 60,
          step: 5,
          value: 30,
          unit: 's',
          description: 'Number select with seconds unit display',
          help: 'Connection timeout in seconds'
        },
        'with-mb-unit': { 
          label: 'Cache Size',
          min: 100,
          max: 1000,
          step: 100,
          value: 500,
          unit: 'MB',
          description: 'Number select with megabytes unit display',
          help: 'Maximum cache size in megabytes'
        },
        'with-percent-unit': {
          label: 'Volume Level',
          min: 0,
          max: 100,
          step: 10,
          value: 70,
          unit: '%',
          description: 'Number select with percentage unit display',
          help: 'Audio volume percentage'
        },
        'no-unit': {
          label: 'Retry Attempts',
          min: 1,
          max: 10,
          step: 1,
          value: 3,
          description: 'Number select without unit (plain numbers)',
          help: 'Number of retry attempts before failing'
        }
      }
    }
  },
  timezone_select: {
    registryKey: 'timezone_select',
    baseProps: {},
    category: 'form',
    docs: {
      title: 'Timezone Select',
      description: 'Timezone selection dropdown',
      examples: {
        basic: { 
          label: 'Timezone', 
          value: 'America/New_York',
          description: 'Basic timezone selector',
          help: 'Select your local timezone'
        },
        'for-scheduling': {
          label: 'Event Timezone',
          value: 'Europe/London',
          description: 'Timezone selection for event scheduling',
          help: 'All event times will be displayed in this timezone'
        }
      }
    }
  },
  switch: {
    registryKey: 'switch',
    baseProps: {},
    category: 'form',
    docs: {
      title: 'Switch Field',
      description: 'Toggle switch for boolean values',
      examples: {
        enabled: { 
          label: 'Enable Notifications', 
          value: true,
          description: 'Switch in enabled (on) state'
        },
        disabled_state: { 
          label: 'Auto-Save', 
          value: false,
          description: 'Switch in disabled (off) state'
        },
        required: { 
          label: 'Accept Terms & Conditions', 
          required: true,
          value: false,
          description: 'Required switch that must be toggled on',
          help: 'You must accept to continue'
        },
        disabled: { 
          label: 'Premium Features', 
          value: false, 
          disabled: true,
          description: 'Disabled switch that cannot be toggled (locked state)'
        }
      }
    }
  },
  button: {
    registryKey: 'button',
    baseProps: {},
    category: 'action',
    docs: {
      title: 'Button Field',
      description: 'Clickable action button',
      examples: {
        primary: { 
          label: 'Actions', 
          buttonTitle: 'Save Settings',
          variant: 'primary',
          description: 'Primary style button for main actions (blue/accent color)'
        },
        secondary: { 
          label: 'Actions',
          buttonTitle: 'Cancel',
          variant: 'secondary',
          description: 'Secondary style button for alternative actions (neutral color)'
        },
        danger: { 
          label: 'Danger Zone',
          buttonTitle: 'Delete Account',
          variant: 'danger',
          description: 'Danger style button for destructive actions (red/error color)'
        },
        disabled: { 
          label: 'Actions',
          buttonTitle: 'Submit',
          disabled: true,
          description: 'Disabled button that cannot be clicked (grayed out)'
        }
      }
    }
  },
  link: {
    registryKey: 'link',
    baseProps: {},
    category: 'action',
    docs: {
      title: 'Action Link',
      description: 'Clickable hyperlink',
      examples: {
        basic: { 
          label: 'Documentation', 
          link: 'docs',
          linklabel: 'View Docs',
          description: 'Basic internal link'
        },
        'with-label': { 
          label: 'Support Resources', 
          link: 'help/support',
          linklabel: 'Get Help',
          description: 'Internal link with custom label'
        },
        external: {
          label: 'External Link',
          link: 'settings/advanced',
          linklabel: 'Advanced Settings',
          description: 'Link to another section or page'
        }
      }
    }
  },
  text_display: {
    registryKey: 'text_display',
    baseProps: {},
    category: 'display',
    docs: {
      title: 'Text Display',
      description: 'Read-only text display',
      examples: {
        info: { 
          label: 'System Info', 
          text: 'All services running',
          variant: 'info',
          description: 'Info style for informational messages (blue color)'
        },
        success: { 
          label: 'Connection', 
          text: 'Connected successfully',
          variant: 'success',
          description: 'Success style for positive status (green color)'
        },
        warning: {
          label: 'Storage',
          text: 'Disk usage at 85%',
          variant: 'warning',
          description: 'Warning style for cautionary messages (orange/yellow color)'
        },
        error: { 
          label: 'Database', 
          text: 'Connection failed',
          variant: 'error',
          description: 'Error style for error messages (red color)'
        }
      }
    }
  },
  badge: {
    registryKey: 'badge',
    baseProps: {},
    category: 'display',
    docs: {
      title: 'Badge Field',
      description: 'Status badge with colored styling',
      examples: {
        info: { 
          label: 'Version', 
          text: 'v2.1.0',
          variant: 'info',
          description: 'Info badge style for informational labels (blue badge)'
        },
        success: { 
          label: 'Status', 
          text: 'Active',
          variant: 'success',
          description: 'Success badge style for positive status (green badge)'
        },
        warning: { 
          label: 'Release', 
          text: 'Beta',
          variant: 'warning',
          description: 'Warning badge style for cautionary labels (orange/yellow badge)'
        },
        error: { 
          label: 'Build', 
          text: 'Failed',
          variant: 'error',
          description: 'Error badge style for error status (red badge)'
        }
      }
    }
  },
  password_pin: {
    registryKey: 'password_pin',
    baseProps: {},
    category: 'form',
    docs: {
      title: 'Password Input',
      description: 'Secure password input field',
      examples: {
        basic: { 
          label: 'Password', 
          placeholder: 'Enter your password',
          value: '',
          description: 'Basic password input field'
        },
        required: { 
          label: 'New Password', 
          placeholder: 'Minimum 8 characters',
          required: true,
          description: 'Required password field for account security',
          help: 'Must be at least 8 characters long'
        },
        'api-key': {
          label: 'API Secret Key',
          placeholder: 'sk_live_...',
          description: 'Secure input for API keys and tokens',
          help: 'Keep this secret and never share it'
        }
      }
    }
  },
  datetime: {
    registryKey: 'datetime',
    baseProps: {},
    category: 'form',
    docs: {
      title: 'DateTime Picker',
      description: 'Date and time selection component',
      examples: {
        basic: { 
          label: 'Appointment Time', 
          value: new Date().toISOString(),
          description: 'Basic date and time picker',
          help: 'Select date and time for your appointment'
        },
        'scheduled-event': { 
          label: 'Event Start Time',
          value: new Date().toISOString(),
          description: 'DateTime picker for event scheduling',
          help: 'Choose when your event begins'
        }
      }
    }
  },
  mac_address: {
    registryKey: 'mac_address',
    baseProps: {},
    category: 'form',
    docs: {
      title: 'MAC Address Input',
      description: 'Formatted MAC address input',
      examples: {
        basic: { 
          label: 'MAC Address', 
          placeholder: '00:00:00:00:00:00',
          value: '',
          description: 'Basic MAC address input with auto-formatting',
          help: 'Hardware address in format AA:BB:CC:DD:EE:FF'
        },
        'device-mac': { 
          label: 'Network Device MAC', 
          placeholder: 'AA:BB:CC:DD:EE:FF',
          value: '',
          description: 'MAC address for network device configuration',
          help: 'Enter the physical address from device label'
        },
        required: { 
          label: 'Client MAC Address',
          placeholder: '00:1A:2B:3C:4D:5E',
          required: true,
          description: 'Required MAC address field with validation',
          help: 'Required for network registration'
        }
      }
    }
  },
  array_sortable: {
    registryKey: 'array_sortable',
    baseProps: {},
    category: 'form',
    docs: {
      title: 'Sortable Array',
      description: 'Drag-and-drop sortable list',
      examples: {
        basic: { 
          label: 'Priority Queue',
          buttonTitle: 'Manage Priorities',
          value: [],
          description: 'Empty sortable list ready for items'
        },
        'with-items': { 
          label: 'Task Priority Order',
          buttonTitle: 'Reorder Tasks',
          value: ['High Priority Task', 'Medium Priority Task', 'Low Priority Task'],
          description: 'Sortable list with items - drag to reorder',
          help: 'Drag items to change priority order'
        }
      }
    }
  }
};

export type ComponentMetadataKey = keyof typeof COMPONENT_METADATA;

