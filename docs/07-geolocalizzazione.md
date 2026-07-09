# Paraggi - STEP 7 - Geolocalizzazione

## Mobile

`apps/mobile/src/hooks/useLocationSync.ts` usa Expo Location per richiedere permesso GPS e inviare fix posizione.

## Backend

`supabase/functions/update-location` calcola:

- accuratezza;
- eta del fix;
- velocita anomala;
- emulatore;
- root/jailbreak predisposto;
- trust score;
- trust status.

## Regole

- coordinate precise solo server-side;
- feed vicino via PostGIS;
- chat validata da `refresh_chat_status`;
- client riceve solo distanza approssimata e area.

