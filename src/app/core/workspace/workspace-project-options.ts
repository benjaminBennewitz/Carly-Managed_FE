// src/app/core/workspace/workspace-project-options.ts

export interface WorkspaceProjectIconOption {
  value: string;
  label: string;
}

export interface WorkspaceProjectColorOption {
  value: string;
  label: string;
}

export const WORKSPACE_PROJECT_ICON_OPTIONS: readonly WorkspaceProjectIconOption[] = [
  { value: 'folder_open', label: 'Ordner' },
  { value: 'workspaces', label: 'Workspace' },
  { value: 'rocket_launch', label: 'Launch' },
  { value: 'code', label: 'Code' },
  { value: 'analytics', label: 'Analyse' },
  { value: 'design_services', label: 'Design' },
  { value: 'inventory_2', label: 'Lieferung' },
  { value: 'campaign', label: 'Kampagne' },
  { value: 'event', label: 'Termin' },
  { value: 'construction', label: 'Technik' },
  { value: 'support_agent', label: 'Support' },
  { value: 'bolt', label: 'Sprint' },
  { value: 'settings', label: 'Setup' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'fact_check', label: 'Qualität' },
  { value: 'hub', label: 'Netzwerk' },
  { value: 'label', label: 'Label' },
  { value: 'print', label: 'Druck' },
  { value: 'palette', label: 'Kreativ' },
];

export const WORKSPACE_PROJECT_COLOR_OPTIONS: readonly WorkspaceProjectColorOption[] = [
  { value: '#7752B3', label: 'Violett' },
  { value: '#4E82A8', label: 'Himmelblau' },
  { value: '#4F9572', label: 'Salbei' },
  { value: '#D5A646', label: 'Gold' },
  { value: '#B9546A', label: 'Mauve' },
  { value: '#A5663F', label: 'Terrakotta' },
  { value: '#607D8B', label: 'Schiefer' },
  { value: '#8A8093', label: 'Nebel' },
];

/** Prüft, ob ein Icon zum freigegebenen Projekt-Iconset gehört. */
export function isWorkspaceProjectIcon(value: string): boolean {
  return WORKSPACE_PROJECT_ICON_OPTIONS.some((option) => option.value === value);
}

/** Prüft, ob eine Farbe zum freigegebenen Projektfarbset gehört. */
export function isWorkspaceProjectColor(value: string): boolean {
  return WORKSPACE_PROJECT_COLOR_OPTIONS.some((option) => option.value === value);
}
