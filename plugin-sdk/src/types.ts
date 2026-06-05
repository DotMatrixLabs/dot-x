export type {
  ApiRequest,
  ApiResponse,
  BadgeField,
  BaseSettingsField,
  ButtonField,
  ChannelTarget,
  ChannelTargetsAllResponse,
  ChannelTargetsByChannel,
  ChannelTargetsForChannelResponse,
  DeviceChanges,
  DeviceConnectionCallback,
  DeviceInfo,
  DeviceUpdateCallback,
  InfoField,
  InputField,
  LinkField,
  PluginAPI,
  PluginConfigStore,
  PluginInfo,
  RGBEffect,
  RGBOptions,
  RGBState,
  SelectField,
  SettingsComponent,
  SettingsField,
  SettingsSection,
  SettingsSections,
  SwitchField,
  TextField,
  ToastParams,
} from './generated/types';

import type { SettingsSections } from './generated/types';

export interface SystemUtilButton {
  id: string;
  title: string;
  icon?: string;
  hidden?: boolean;
  disabled?: boolean;
  onClick?: (evt: { selected: boolean; channel: number | string }) => void;
  actionId?: string;
  selectedByChannel?: Record<string, boolean>;
  settings?: SettingsSections;
}

export interface ActionMappings {
  buttons: SystemUtilButton[];
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
