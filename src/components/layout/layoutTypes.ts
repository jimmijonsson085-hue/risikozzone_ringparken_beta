export type RightPanelTab =
  | 'substances'
  | 'puff24h'
  | 'algedonic'
  | 'noiseDust'
  | 'indoorClimate'
  | 'compliance'
  | 'grounding'
  | 'bioscience';

export type ViewportVisualizationMode =
  | '3d'
  | 'underground_3d'
  | 'underground_2d'
  | 'underground_split'
  | 'split'
  | '2d';

export type DeviceEditionSelection = 'auto' | 'standard' | 'tablet' | 'mobile';
export type OrientationSelection = 'auto' | 'portrait' | 'landscape';
export type UiDensityMode = 'comfortable' | 'compact';
