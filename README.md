# Paraggi

La piazza digitale delle persone vicine.

Questo repository contiene il monorepo dell'MVP mobile-first di Paraggi.

## Stato avanzamento

- STEP 1: Analisi funzionale completata.
- STEP 2: Architettura in corso/completata in `docs/02-architettura.md`.
- STEP 3: Database da confermare.

## Struttura

```text
apps/
  mobile/        App React Native + Expo
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

L'APK di test sara generato negli step Frontend/Deployment tramite Expo/EAS con profilo Android `preview`.

Comando previsto:

```bash
npm run mobile:build:apk
```

Il comando sara attivabile appena lo scheletro Expo sara creato nello STEP 5.
