# Paraggi

La piazza digitale delle persone vicine.

Questo repository contiene il monorepo dell'MVP mobile-first di Paraggi.

## Stato avanzamento

- STEP 1: Analisi funzionale completata.
- STEP 2: Architettura completata in `docs/02-architettura.md`.
- STEP 3-10: MVP integrato con app Expo, Supabase, Realtime e build locali.

## Struttura

```text
apps/
  mobile/        App React Native + Expo
  web/           Landing page pubblica di Paraggi
  admin/         Pannello admin web, non primario per MVP
packages/
  domain/        Entita, value object, policy pure
  application/   Use case, port, orchestrazione applicativa
  infrastructure/Adapter Supabase, storage, push, geolocation
  ui/            Design system condiviso mobile-first
supabase/
  migrations/    Schema PostgreSQL/PostGIS e RLS
  functions/     Edge Functions
docs/
  adr/           Architecture Decision Records
outputs/         Deliverable approvati per revisione
```

## Build Android APK

La build Android di test viene eseguita localmente con Mise. Il task installa o aggiorna l'Android SDK necessario, genera il progetto nativo, crea una release standalone e verifica bundle e firma.

```bash
mise run debug
```

APK generato:

```bash
apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

Non serve Metro. Il repository non contiene workflow GitHub Actions: build e controlli vengono eseguiti esclusivamente in locale.

## Landing page

La landing pubblica racconta visione, missione, funzionamento, privacy e principali esperienze dell'app. E sviluppata con Vite e utilizza immagini ottimizzate e schermate reali del prodotto.

Avvio locale:

```bash
npm run web:dev
```

Build di produzione:

```bash
npm run web:build
```

I file compilati vengono generati in `apps/web/dist` e non sono versionati.

## Push Android

Le notifiche locali e gli eventi Realtime funzionano senza Firebase. Per ricevere push remoti in background su una build Android locale serve il file client Firebase:

1. creare o collegare un progetto Firebase con package `app.paraggi.mobile`;
2. scaricare `google-services.json`;
3. inserirlo in `apps/mobile/google-services.json`;
4. rigenerare l'APK con `mise run debug`.

Il file e escluso da Git. `apps/mobile/app.config.js` lo collega automaticamente quando presente. Le Edge Functions inviano commenti, richieste, accettazioni, messaggi e SOS tramite Expo Push e disattivano i token non piu validi.
