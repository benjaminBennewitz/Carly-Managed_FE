// src/app/core/weather/weather.models.ts

/** Kompakter Wetterstand für die Workspace-Werkzeugleiste. */
export interface CurrentWeatherSnapshot {
  locationLabel: string;
  temperatureCelsius: number;
  apparentTemperatureCelsius: number;
  windSpeedKmh: number;
  weatherCode: number;
  conditionLabel: string;
  icon: string;
}
