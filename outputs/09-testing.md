# Paraggi - STEP 9 - Testing

## Unit test

- `packages/application/src/proximity.test.ts`
- `supabase/functions/_shared/location.test.ts`

## Integration test previsti

- RLS per profili, post, commenti, chat, messaggi.
- RPC `get_nearby_posts`.
- RPC `refresh_chat_status`.
- Edge Functions con JWT valido/non valido.

## E2E mobile previsti

Scenari:

1. registrazione -> permesso GPS -> feed;
2. post -> commento -> richiesta privata -> accettazione;
3. chat attiva -> distanza oltre soglia -> frozen -> ritorno vicino -> active;
4. offline message pending -> sync rifiutata se chat frozen;
5. export/delete account.

## Comandi

```bash
npm test
npm run typecheck
```

