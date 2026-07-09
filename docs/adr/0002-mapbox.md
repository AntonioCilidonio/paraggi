# ADR 0002 - Mapbox per mappe e heatmap

Data: 2026-07-09
Stato: accettata proposta

## Contesto

Paraggi richiede heatmap aggregate, privacy geografica e controllo visuale mobile. Non deve mostrare utenti precisi.

## Decisione

Usare Mapbox per MVP.

## Motivazione

- Buon supporto heatmap.
- Stile personalizzabile.
- Ottima resa dark/light mode.
- Adatto a visualizzare aree aggregate.
- Evita una UX centrata sui marker personali.

## Conseguenze

- Servira gestire token Mapbox.
- Su Expo potrebbe essere necessaria dev build per moduli nativi.
- La pipeline APK dovra considerare configurazione EAS.

