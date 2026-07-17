// src/app/core/auth/services/auth.service.spec.ts

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AuthService } from './auth.service';
import { SessionService } from './session.service';

const USER = {
  id: '00000000-0000-0000-0000-000000000001',
  displayName: 'Demo Owner',
  email: 'owner@example.test',
  emailVerified: true,
  avatarUrl: null,
};

describe('AuthService', () => {
  let service: AuthService;
  let sessionService: SessionService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    sessionService = TestBed.inject(SessionService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('holt vor dem Login ein CSRF-Cookie und startet die Sitzung', () => {
    service
      .login({ email: USER.email, password: 'Sicheres-Testpasswort-2026!', rememberMe: false })
      .subscribe();

    httpTesting.expectOne('/api/v1/auth/csrf/').flush({ csrfToken: 'csrf-token' });
    const loginRequest = httpTesting.expectOne('/api/v1/auth/login/');
    expect(loginRequest.request.method).toBe('POST');
    expect(loginRequest.request.body.email).toBe(USER.email);
    loginRequest.flush({ user: USER });

    expect(sessionService.currentUser()).toEqual(USER);
  });

  it('entfernt den lokalen Nutzerzustand beim Logout', () => {
    sessionService.startSession(USER);
    service.logout().subscribe();

    const request = httpTesting.expectOne('/api/v1/auth/logout/');
    expect(request.request.method).toBe('POST');
    request.flush(null);

    expect(sessionService.currentUser()).toBeNull();
  });
});
