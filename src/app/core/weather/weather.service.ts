// src/app/core/weather/weather.service.ts

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { finalize, map, Subscription, switchMap } from 'rxjs';

import { CurrentWeatherSnapshot } from './weather.models';

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

interface OpenMeteoGeocodingResponse {
  results?: {
    name: string;
    latitude: number;
    longitude: number;
    country?: string;
    admin1?: string;
  }[];
}

interface OpenMeteoForecastResponse {
  current?: {
    temperature_2m: number;
    apparent_temperature: number;
    weather_code: number;
    wind_speed_10m: number;
  };
}

@Injectable({ providedIn: 'root' })
export class WeatherService {
  private readonly currentState = signal<CurrentWeatherSnapshot | null>(null);
  private readonly loadingState = signal(false);
  private readonly errorState = signal('');
  private requestSubscription: Subscription | null = null;
  private lastLocation = '';

  readonly current = this.currentState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  constructor(private readonly http: HttpClient) {}

  /** Lädt Geocoding und aktuelle Wetterwerte ohne API-Schlüssel über Open-Meteo. */
  load(location: string, force = false): void {
    const normalizedLocation = location.trim();
    if (!normalizedLocation) {
      this.clear();
      this.errorState.set('Standort festlegen');
      return;
    }
    if (!force && normalizedLocation === this.lastLocation && this.currentState()) return;

    this.requestSubscription?.unsubscribe();
    this.lastLocation = normalizedLocation;
    this.loadingState.set(true);
    this.errorState.set('');

    const geocodingParams = new HttpParams()
      .set('name', normalizedLocation)
      .set('count', 1)
      .set('language', 'de')
      .set('format', 'json');

    this.requestSubscription = this.http
      .get<OpenMeteoGeocodingResponse>(GEOCODING_URL, { params: geocodingParams })
      .pipe(
        map((geocoding) => {
          const place = geocoding.results?.[0];
          if (!place) throw new Error('location_not_found');
          return place;
        }),
        switchMap((place) => {
          const forecastParams = new HttpParams()
            .set('latitude', place.latitude)
            .set('longitude', place.longitude)
            .set(
              'current',
              'temperature_2m,apparent_temperature,weather_code,wind_speed_10m',
            )
            .set('timezone', 'auto');

          return this.http
            .get<OpenMeteoForecastResponse>(FORECAST_URL, { params: forecastParams })
            .pipe(map((forecast) => ({ place, forecast })));
        }),
        map(({ place, forecast }) => {
          const current = forecast.current;
          if (!current) throw new Error('weather_unavailable');
          const condition = this.describeWeatherCode(current.weather_code);
          return {
            locationLabel: this.locationLabel(place),
            temperatureCelsius: current.temperature_2m,
            apparentTemperatureCelsius: current.apparent_temperature,
            windSpeedKmh: current.wind_speed_10m,
            weatherCode: current.weather_code,
            conditionLabel: condition.label,
            icon: condition.icon,
          } satisfies CurrentWeatherSnapshot;
        }),
        finalize(() => this.loadingState.set(false)),
      )
      .subscribe({
        next: (current) => this.currentState.set(current),
        error: (error: unknown) => {
          this.currentState.set(null);
          this.errorState.set(
            error instanceof Error && error.message === 'location_not_found'
              ? 'Standort nicht gefunden'
              : 'Wetter nicht verfügbar',
          );
        },
      });
  }

  /** Entfernt den aktuell angezeigten Wetterstand und laufende Requests. */
  clear(): void {
    this.requestSubscription?.unsubscribe();
    this.requestSubscription = null;
    this.lastLocation = '';
    this.currentState.set(null);
    this.loadingState.set(false);
    this.errorState.set('');
  }

  /** Baut eine kurze, möglichst eindeutige Ortsbezeichnung. */
  private locationLabel(place: { name: string; admin1?: string; country?: string }): string {
    const region = place.admin1 && place.admin1 !== place.name ? place.admin1 : place.country;
    return region ? `${place.name}, ${region}` : place.name;
  }

  /** Übersetzt WMO-Wettercodes in Material-Symbol und deutsche Kurzbezeichnung. */
  private describeWeatherCode(code: number): { label: string; icon: string } {
    if (code === 0) return { label: 'Klar', icon: 'clear_day' };
    if ([1, 2].includes(code)) return { label: 'Leicht bewölkt', icon: 'partly_cloudy_day' };
    if (code === 3) return { label: 'Bewölkt', icon: 'cloud' };
    if ([45, 48].includes(code)) return { label: 'Nebel', icon: 'foggy' };
    if ([51, 53, 55, 56, 57].includes(code)) return { label: 'Nieselregen', icon: 'rainy_light' };
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
      return { label: 'Regen', icon: 'rainy' };
    }
    if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: 'Schnee', icon: 'weather_snowy' };
    if ([95, 96, 99].includes(code)) return { label: 'Gewitter', icon: 'thunderstorm' };
    return { label: 'Wetter', icon: 'partly_cloudy_day' };
  }
}
