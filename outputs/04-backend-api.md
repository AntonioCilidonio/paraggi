# Paraggi - STEP 4 - Backend/API

Le API sono implementate come Supabase Edge Functions in `supabase/functions`.

## Endpoint

| Function | Method | Purpose |
|---|---:|---|
| `update-location` | POST | Salva posizione, calcola trust score, aggiorna cronologia area |
| `get-nearby-feed` | GET | Restituisce feed vicino tramite PostGIS |
| `create-post` | POST | Crea post temporaneo geolocalizzato |
| `create-comment` | POST | Crea commento su post attivo |
| `request-connection` | POST | Crea richiesta privata contestuale |
| `respond-connection` | POST | Accetta/rifiuta richiesta e crea chat |
| `send-private-message` | POST | Invia messaggio solo se chat attiva |
| `register-push-token` | POST | Registra device/token Expo |
| `sync-offline-actions` | POST | Punto unico per sync offline |
| `report-content` | POST | Segnala contenuto o utente |
| `block-user` | POST | Blocca un utente |
| `export-account-data` | GET | Esporta dati GDPR |
| `delete-account` | DELETE | Elimina account |

## Realtime

Canali previsti:

- `area:{areaId}:posts`
- `post:{postId}:comments`
- `user:{userId}:requests`
- `chat:{chatId}:messages`
- `chat:{chatId}:status`
- `user:{userId}:notifications`

## Sicurezza

- Tutte le funzioni richiedono JWT Supabase.
- Le funzioni critiche scrivono audit log.
- La chat viene rivalidata con `refresh_chat_status` prima di salvare messaggi.
- Le coordinate non sono mai restituite dalle API di feed.

