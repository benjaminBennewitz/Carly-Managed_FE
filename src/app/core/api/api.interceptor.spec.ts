// src/app/core/api/api.interceptor.spec.ts

import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { apiInterceptor } from './api.interceptor';

describe('apiInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    document.cookie = 'cm_csrftoken=csrf-test-token; path=/';
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    document.cookie = 'cm_csrftoken=; Max-Age=0; path=/';
  });

  it('sendet Cookies und CSRF-Header bei schreibenden API-Requests', () => {
    http.post('/api/v1/demo/reset/', {}).subscribe();

    const request = httpTesting.expectOne('/api/v1/demo/reset/');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.get('X-CSRFToken')).toBe('csrf-test-token');
    request.flush({});
  });

  it('verändert keine externen Requests', () => {
    http.get('https://example.test/data').subscribe();

    const request = httpTesting.expectOne('https://example.test/data');
    expect(request.request.withCredentials).toBe(false);
    expect(request.request.headers.has('X-CSRFToken')).toBe(false);
    request.flush({});
  });
});
