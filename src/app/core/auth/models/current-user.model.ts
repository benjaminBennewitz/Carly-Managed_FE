// src/app/core/auth/models/current-user.model.ts

/**
 * Repräsentiert die für das Frontend benötigten Daten des angemeldeten Nutzers.
 */
export interface CurrentUser {
  id: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  avatarUrl: string | null;
}
