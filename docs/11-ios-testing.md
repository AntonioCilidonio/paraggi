# Test iOS

## iPhone personale senza abbonamento Apple Developer

Paraggi dispone di una variante locale firmabile con il `Personal Team`
gratuito di Xcode. La variante usa:

- nome app `Paraggi Dev`;
- bundle identifier `com.antoniocilidonio.paraggi.dev`;
- Supabase e tutte le funzioni applicative normali;
- notifiche locali, ma non push remote APNs.

Prima esecuzione:

1. Collegare l'iPhone al Mac e confermare `Autorizza questo computer`.
2. In Xcode, aprire `Settings > Apple Accounts` e aggiungere il proprio
   Apple Account.
3. Su iPhone, abilitare `Impostazioni > Privacy e sicurezza > Modalita
   sviluppatore`.
4. Dal root del repository eseguire:

```bash
npm run mobile:ios:device:personal
```

Expo genera il progetto iOS, permette di scegliere l'iPhone collegato e avvia
la compilazione. Se Xcode richiede il team, aprire
`apps/mobile/ios/ParaggiDev.xcworkspace`, selezionare il target `ParaggiDev`, quindi
`Signing & Capabilities > Automatically manage signing` e scegliere il
`Personal Team`.

La firma gratuita scade dopo 7 giorni. Allo scadere basta rieseguire lo stesso
comando per reinstallare l'app.

## iPhone con Apple Developer attivo

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
- Versione app: `1.0.0`.
- Build number attuale: `100`.
