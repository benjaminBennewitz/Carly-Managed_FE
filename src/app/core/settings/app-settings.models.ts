// src/app/core/settings/app-settings.models.ts

export type ColorVisionMode =
  'standard' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'monochrome';

export type AccessibilityFontSize = 'normal' | 'large' | 'xlarge';

export type WorkspaceAlarmCategory =
  | 'assignment'
  | 'taskMove'
  | 'taskCompleted'
  | 'taskReopened'
  | 'taskChanged'
  | 'taskDeleted'
  | 'projectCreated'
  | 'projectChanged'
  | 'projectCompleted'
  | 'projectArchived'
  | 'projectDeleted'
  | 'members'
  | 'directMessages';

export interface AccessibilitySettings {
  colorVisionMode: ColorVisionMode;
  neuroMode: boolean;
  reduceMotion: boolean;
  reduceHover: boolean;
  magnifier: boolean;
  fontSize: AccessibilityFontSize;
  highContrast: boolean;
}

export interface WorkspaceAlarmSettings {
  assignment: boolean;
  taskMove: boolean;
  taskCompleted: boolean;
  taskReopened: boolean;
  taskChanged: boolean;
  taskDeleted: boolean;
  projectCreated: boolean;
  projectChanged: boolean;
  projectCompleted: boolean;
  projectArchived: boolean;
  projectDeleted: boolean;
  members: boolean;
  directMessages: boolean;
}

export interface GeneralSettings {
  dynamicNewColumns: boolean;
  tooltipsEnabled: boolean;
  allowInvites: boolean;
  hideRealName: boolean;
  realName: string;
  nickname: string;
  alarms: WorkspaceAlarmSettings;
}

export interface ToolSettings {
  pomodoro: boolean;
  taskTimer: boolean;
  weather: boolean;
  weatherLocation: string;
}

export interface AppSettings {
  accessibility: AccessibilitySettings;
  general: GeneralSettings;
  tools: ToolSettings;
  version?: number;
}
