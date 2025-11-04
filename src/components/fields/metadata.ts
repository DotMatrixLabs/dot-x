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
          value: '' 
        },
        required: { 
          label: 'Email', 
          placeholder: 'email@example.com', 
          required: true 
        },
        disabled: { 
          label: 'Username', 
          value: 'admin', 
          disabled: true 
        },
        'with-placeholder': { 
          label: 'Search', 
          placeholder: 'Type to search...' 
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
          label: 'Name', 
          placeholder: 'Enter your name', 
          value: '' 
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
          value: 25 
        },
        'with-min-max': { 
          label: 'Port', 
          value: 8080, 
          min: 1, 
          max: 65535 
        },
        required: { 
          label: 'Quantity', 
          required: true 
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
          value: '127.0.0.1' 
        },
        required: { 
          label: 'Gateway IP', 
          placeholder: '192.168.0.1', 
          required: true 
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
          options: ['USA', 'UK', 'Canada'], 
          value: 'USA' 
        },
        'with-options': { 
          label: 'Quality',
          options: [
            { value: 'low', label: 'Low Quality' },
            { value: 'medium', label: 'Medium Quality' },
            { value: 'high', label: 'High Quality' }
          ],
          value: 'low'
        },
        required: { 
          label: 'Region', 
          options: ['North', 'South', 'East', 'West'], 
          required: true,
          placeholder: 'Select a region'
        },
        disabled: { 
          label: 'Status', 
          options: ['Active', 'Inactive'], 
          value: 'Active', 
          disabled: true 
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
        basic: { 
          label: 'Timeout (seconds)', 
          options: [5, 10, 15, 30, 60], 
          value: 10 
        },
        'with-range': { 
          label: 'Retry Count', 
          options: [1, 3, 5, 10], 
          value: 3 
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
          value: 'America/New_York' 
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
        basic: { 
          label: 'Enable Feature', 
          value: true 
        },
        required: { 
          label: 'Accept Terms', 
          required: true,
          value: false
        },
        disabled: { 
          label: 'Premium Mode', 
          value: false, 
          disabled: true 
        },
        'with-description': {
          label: 'Debug Mode',
          description: 'Enable detailed logging for troubleshooting',
          value: false
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
          style: 'primary'
        },
        secondary: { 
          label: 'Actions',
          buttonTitle: 'Cancel',
          style: 'secondary'
        },
        danger: { 
          label: 'Danger Zone',
          buttonTitle: 'Delete Account',
          style: 'danger'
        },
        disabled: { 
          label: 'Actions',
          buttonTitle: 'Save',
          disabled: true
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
          text: 'View Docs',
          href: 'https://docs.example.com'
        },
        external: { 
          label: 'Support', 
          text: 'Get Help',
          href: 'https://support.example.com'
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
        default: { 
          label: 'Status', 
          text: 'Connected',
          style: 'default'
        },
        info: { 
          label: 'Info', 
          text: 'System operational',
          style: 'info'
        },
        success: { 
          label: 'Status', 
          text: 'Connection established',
          style: 'success'
        },
        error: { 
          label: 'Error', 
          text: 'Connection failed',
          style: 'error'
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
          text: 'v1.0.0',
          style: 'info'
        },
        success: { 
          label: 'Status', 
          text: 'Active',
          style: 'success'
        },
        warning: { 
          label: 'Warning', 
          text: 'Beta',
          style: 'warning'
        },
        error: { 
          label: 'Error', 
          text: 'Failed',
          style: 'error'
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
          placeholder: 'Enter password',
          value: ''
        },
        required: { 
          label: 'New Password', 
          placeholder: 'Enter new password',
          required: true
        },
        'with-toggle': {
          label: 'API Key',
          placeholder: 'Enter your API key',
          description: 'Your secret API key'
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
          label: 'Schedule Time', 
          value: new Date().toISOString()
        },
        'date-only': { 
          label: 'Birth Date', 
          mode: 'date'
        },
        'time-only': { 
          label: 'Alarm Time', 
          mode: 'time'
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
          value: ''
        },
        'with-validation': { 
          label: 'Device MAC', 
          placeholder: 'AA:BB:CC:DD:EE:FF',
          required: true
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
          label: 'Priority List', 
          value: []
        },
        'with-items': { 
          label: 'Task Order', 
          value: ['Task 1', 'Task 2', 'Task 3']
        }
      }
    }
  }
};

export type ComponentMetadataKey = keyof typeof COMPONENT_METADATA;

