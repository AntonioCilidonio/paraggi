# Utenti test Supabase

Durante i test multi-dispositivo puo comparire:

```text
email rate limit exceeded
```

Questo non e un errore dell'app: Supabase Auth limita l'invio di email di conferma quando vengono creati molti account in poco tempo.

## Soluzione consigliata per staging/test

Nel progetto Supabase:

1. Apri **Authentication**.
2. Vai in **Sign In / Providers**.
3. Apri **Email**.
4. Disattiva temporaneamente **Confirm email** per l'ambiente di test.

In questo modo la registrazione restituisce subito una sessione valida e puoi testare Paraggi su due telefoni senza aspettare email di conferma.

## Alternative

- Aspetta alcuni minuti e riprova.
- Usa account gia registrati e confermati.
- Usa alias email diversi, per esempio Gmail supporta `nome+test1@gmail.com`, `nome+test2@gmail.com`.

Per la produzione, la conferma email puo essere riattivata.
