# Test iOS con Expo/EAS

Paraggi puo essere testata su iPhone con una build EAS iOS `preview`.

## Requisiti

- Account Expo gia collegato.
- Account Apple Developer attivo per installare su iPhone fisico.
- Secrets EAS gia configurati:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Build per iPhone fisico

Dal root del repository:

```bash
npm run mobile:build:ios
```

Durante la prima build EAS puo chiedere:

- login Apple;
- team Apple Developer;
- creazione certificato iOS Distribution;
- creazione provisioning profile;
- registrazione del dispositivo iPhone.

Accetta la gestione automatica delle credenziali Expo quando proposta.

Alla fine EAS fornisce un link. Aprilo da iPhone e installa l'app.

## Build simulatore

Per un controllo rapido senza iPhone fisico:

```bash
npm run mobile:build:ios:simulator
```

La build simulatore non sostituisce il test reale: notifiche push, GPS e permessi vanno validati su iPhone fisico.

## Note

- Bundle identifier iOS: `app.paraggi.mobile`.
- Versione app: `0.1.0`.
- Build number attuale: `16`.
