// src/app/core/system/connectivity.service.ts

import { computed, DestroyRef, Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ConnectivityService {
  private readonly onlineState = signal(window.navigator.onLine);

  readonly isOnline = this.onlineState.asReadonly();
  readonly label = computed(() => (this.onlineState() ? 'Online' : 'Offline'));
  readonly icon = computed(() => (this.onlineState() ? 'cloud_done' : 'cloud_off'));

  constructor(destroyRef: DestroyRef) {
    const updateOnlineStatus = (): void => {
      this.onlineState.set(window.navigator.onLine);
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    destroyRef.onDestroy(() => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    });
  }
}
