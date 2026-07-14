// src/app/core/legal/legal.config.ts

/**
 * Zentrale Betreiberdaten für Impressum und Datenschutzerklärung.
 * Die markierten Angaben müssen vor einer öffentlichen Bereitstellung ersetzt werden.
 */
export const LEGAL_PROVIDER = {
  appName: 'Carly Managed',
  name: 'Benjamin Bennewitz',
  street: 'Straße und Hausnummer ergänzen',
  postalCode: 'PLZ ergänzen',
  city: 'Mönchengladbach',
  country: 'Deutschland',
  email: 'E-Mail-Adresse ergänzen',
  phone: '',
  businessName: '',
  vatId: '',
} as const;
