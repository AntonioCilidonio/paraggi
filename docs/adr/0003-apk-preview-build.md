# ADR 0003 - APK Android preview con EAS

Data: 2026-07-09
Stato: accettata proposta

## Contesto

Serve un artefatto installabile facilmente su Android per testare l'MVP durante lo sviluppo.

## Decisione

Configurare un profilo EAS `preview` che generi APK Android.

Comando previsto:

```bash
npm run mobile:build:apk
```

## Conseguenze

Vantaggi:

- test semplice su device Android;
- distribuzione interna rapida;
- separazione da build store.

Costi:

- richiede account/configurazione EAS;
- richiede variabili ambiente di staging;
- build reale disponibile dallo STEP 5/10, non nello STEP 2.

