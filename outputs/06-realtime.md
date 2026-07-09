# Paraggi - STEP 6 - Realtime

Realtime e gestito con Supabase channels.

## Hook mobile

`apps/mobile/src/hooks/useRealtimeChannel.ts`

## Canali

- `post:{postId}:comments`
- `chat:{chatId}:messages`
- `chat:{chatId}:status`
- `user:{userId}:notifications`

## Regole

- Le subscription sono aperte solo nelle schermate necessarie.
- La sicurezza resta in RLS.
- I payload realtime non espongono coordinate.

