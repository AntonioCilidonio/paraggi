# Paraggi - STEP 8 - Chat Geofenced

La chat privata e attiva solo quando gli utenti sono entro il raggio condiviso.

## Stati

- `active`
- `frozen_distance`
- `frozen_permission`
- `frozen_moderation`
- `closed`

## Validazione

Tre livelli:

- UI disabilita input se stato diverso da `active`;
- Edge Function `send-private-message` richiama `refresh_chat_status`;
- Database calcola distanza con PostGIS sulle ultime location affidabili.

## Esperienza utente

Lo storico resta leggibile. L'invio messaggi viene impedito quando gli utenti si allontanano e si riattiva quando tornano vicini.

