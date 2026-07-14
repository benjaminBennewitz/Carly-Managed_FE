// src/app/app.component.spec.ts

import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app.component';

/**
 * Prüft die technische Root-Komponente der Anwendung.
 */
describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('erstellt die Anwendung', () => {
    const fixture = TestBed.createComponent(App);

    expect(fixture.componentInstance).toBeTruthy();
  });
});
