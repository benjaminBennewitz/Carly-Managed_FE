// src/app/shared/ui/dropdown/dropdown-coordinator.service.spec.ts

import { TestBed } from '@angular/core/testing';

import { DropdownCoordinatorService } from './dropdown-coordinator.service';

describe('DropdownCoordinatorService', () => {
  let service: DropdownCoordinatorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DropdownCoordinatorService);
  });

  it('öffnet immer nur ein Dropdown', () => {
    service.open('first');
    service.open('second');

    expect(service.activeId()).toBe('second');
  });

  it('schließt ein aktives Dropdown bei erneutem Umschalten', () => {
    service.toggle('menu');
    service.toggle('menu');

    expect(service.activeId()).toBeNull();
  });

  it('ignoriert das Schließen eines nicht aktiven Dropdowns', () => {
    service.open('active');
    service.close('other');

    expect(service.activeId()).toBe('active');
  });
});
