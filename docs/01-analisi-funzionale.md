# Paraggi - STEP 1 - Analisi funzionale

Versione: 0.1 MVP
Data: 2026-07-09
Stato: pronto per revisione

## 1. Sintesi prodotto

Paraggi e una app mobile di comunicazione geolocalizzata in cui le interazioni digitali sono abilitate dalla presenza fisica nello stesso luogo.

Il prodotto non costruisce un grafo sociale permanente. Non esistono follower, amici o contatti globali. L'unita centrale e il luogo condiviso: feed, commenti, richieste private e chat sono permessi solo entro regole di prossimita, sicurezza e consenso.

La promessa principale dell'MVP e:

> parlare con persone realmente vicine, mantenendo privacy, controllo e sicurezza.

## 2. Obiettivi MVP

L'MVP deve permettere a un utente di:

- creare account e accedere;
- completare/modificare il profilo;
- caricare un avatar;
- concedere o negare permesso GPS;
- scegliere il raggio di ricerca tra 100 m, 500 m, 1 km, 5 km;
- pubblicare post geolocalizzati temporanei;
- leggere post vicini senza vedere coordinate precise;
- commentare pubblicamente i post;
- richiedere una connessione privata partendo da una interazione pubblica;
- accettare o rifiutare richieste private;
- usare chat private vincolate alla vicinanza fisica;
- vedere la chat congelarsi quando gli utenti si allontanano;
- vedere la chat riattivarsi quando tornano vicini;
- ricevere notifiche push;
- consultare la cronologia delle aree visitate;
- bloccare e segnalare utenti/contenuti;
- eliminare account o richiedere esportazione/eliminazione dati.

## 3. Principi funzionali non negoziabili

### 3.1 Presenza fisica come permesso

La vicinanza fisica non e solo un filtro di ricerca: e una regola di autorizzazione.

Azioni abilitate dalla prossimita:

- vedere post attivi vicini;
- commentare post vicini;
- inviare richieste di connessione;
- inviare messaggi in chat attive;
- ricevere notifiche locali rilevanti.

Azioni non abilitate dalla prossimita:

- vedere utenti precisi su mappa;
- vedere coordinate GPS;
- continuare una chat quando gli utenti sono fuori soglia;
- creare relazioni permanenti indipendenti dal luogo.

### 3.2 Privacy geografica

L'app non mostra mai coordinate GPS. L'utente vede solo:

- distanza approssimativa;
- nome area;
- citta;
- luogo o punto di interesse generalizzato;
- heatmap aggregata.

Le coordinate possono essere trattate solo lato backend/database per calcoli PostGIS, sicurezza, audit e regole di autorizzazione.

### 3.3 Relazioni temporanee e contestuali

Una connessione privata nasce da:

1. post pubblico;
2. commento pubblico;
3. richiesta di connessione;
4. accettazione;
5. chat privata.

La chat non crea un contatto permanente. Lo storico rimane visibile, ma la capacita di inviare nuovi messaggi dipende dalla distanza corrente tra gli utenti.

## 4. Attori

### 4.1 Utente anonimo

Puo:

- aprire app;
- vedere onboarding;
- leggere privacy/termini;
- registrarsi o fare login.

Non puo:

- vedere feed;
- pubblicare;
- commentare;
- avviare chat.

### 4.2 Utente autenticato senza GPS

Puo:

- gestire profilo;
- impostare avatar;
- consultare impostazioni privacy;
- vedere stato permessi;
- eliminare account.

Non puo:

- vedere contenuti vicini;
- pubblicare post geolocalizzati;
- inviare richieste private;
- usare chat attive.

### 4.3 Utente autenticato con GPS valido

Puo:

- usare feed locale;
- pubblicare;
- commentare;
- richiedere connessioni;
- usare chat quando vicino;
- consultare aree visitate;
- ricevere notifiche.

### 4.4 Utente moderato o limitato

Puo essere soggetto a:

- rate limiting;
- blocco pubblicazione;
- shadow ban predisposto;
- sospensione richieste private;
- limitazione notifiche;
- audit rafforzato.

### 4.5 Amministratore/moderatore

Nel perimetro MVP il pannello admin puo essere documentato e predisposto, ma non e prioritario rispetto all'app mobile. Deve comunque essere supportato da:

- ruoli;
- audit log;
- report;
- stato moderazione;
- shadow ban flag.

## 5. Moduli funzionali

### 5.1 Autenticazione

Funzionalita:

- registrazione email/password;
- login;
- logout;
- refresh sessione;
- recupero password;
- eliminazione account;
- gestione sessioni device.

Criteri:

- ogni utente applicativo corrisponde a un utente Supabase Auth;
- il profilo pubblico e separato dall'identita auth;
- accesso ai dati protetto da Row Level Security;
- token e refresh token gestiti tramite SDK Supabase.

### 5.2 Profilo

Campi MVP:

- id utente;
- display name;
- bio breve;
- avatar;
- reputazione sintetica;
- badge;
- citta/area prevalente opzionale e non precisa;
- lingua;
- impostazioni privacy;
- stato account.

Regole:

- il display name e obbligatorio;
- l'avatar e opzionale;
- coordinate e cronologia precisa non sono visibili nel profilo pubblico;
- un utente bloccato non puo interagire con chi lo ha bloccato.

### 5.3 Geolocalizzazione e raggio

Raggi supportati:

- 100 metri;
- 500 metri;
- 1 km;
- 5 km.

Funzionalita:

- richiesta permesso GPS;
- rilevamento posizione;
- salvataggio posizione con precisione e timestamp;
- calcolo distanza lato database con PostGIS;
- reverse geocoding o area matching per nome area;
- punteggio affidabilita posizione.

Regole:

- se GPS assente, feed e chat attive sono disabilitati;
- se posizione obsoleta, richiedere aggiornamento;
- se accuratezza insufficiente, ridurre fiducia posizione;
- mai mostrare coordinate all'utente;
- il raggio scelto dall'utente non puo superare 5 km nell'MVP.

### 5.4 Anti GPS spoofing

Segnali MVP:

- accuratezza GPS;
- velocita di movimento anomala;
- salti geografici impossibili;
- device emulator/root/jailbreak quando rilevabile;
- frequenza aggiornamenti sospetta;
- mismatch tra posizione corrente e aree recenti;
- eta del fix GPS.

Output:

- location trust score da 0 a 100;
- stato: trusted, uncertain, suspicious, blocked;
- audit event per anomalie critiche.

Regole:

- trusted: funzionalita complete;
- uncertain: feed consentito, azioni sensibili limitabili;
- suspicious: blocco pubblicazione/chat e richiesta nuovo fix;
- blocked: blocco temporaneo funzioni geolocalizzate.

### 5.5 Feed locale

Ogni post mostra:

- autore;
- avatar;
- categoria;
- testo;
- data;
- distanza approssimativa;
- tempo residuo;
- numero commenti;
- reputazione autore.

Categorie:

- Domanda;
- Informazione;
- Oggetto smarrito;
- Aiuto;
- Evento;
- Socializzazione;
- Emergenza.

Scadenze:

- 30 minuti;
- 3 ore;
- 24 ore.

Regole:

- vengono mostrati solo post attivi entro il raggio scelto;
- post scaduti diventano storici;
- i post storici restano consultabili tramite cronologia area dove consentito;
- post emergenza possono avere priorita visiva e notifiche piu restrittive;
- contenuti da utenti bloccati o shadow banned non devono essere visibili agli utenti ordinari.

### 5.6 Commenti pubblici

Funzionalita:

- leggere commenti di un post vicino;
- pubblicare commento;
- segnalare commento;
- cancellare proprio commento;
- ricevere notifica su nuovo commento al proprio post.

Regole:

- commentare richiede GPS valido e prossimita al post;
- commenti offensivi o spam vengono bloccati o messi in revisione;
- commenti su post scaduti sono disabilitati nell'MVP.

### 5.7 Richieste di connessione

Flusso:

1. utente A pubblica post;
2. utente B commenta;
3. A o B invia richiesta privata legata a quel post/commento;
4. destinatario accetta o rifiuta;
5. se accettata, viene creata o attivata chat privata.

Stati:

- pending;
- accepted;
- rejected;
- expired;
- cancelled;
- blocked.

Regole:

- richiesta consentita solo se esiste interazione pubblica;
- richiesta consentita solo entro raggio valido;
- richieste duplicate pending sono vietate;
- richieste da utenti bloccati sono vietate;
- richiesta puo scadere automaticamente.

### 5.8 Chat privata geofenced

Stati chat:

- active;
- frozen_distance;
- frozen_permission;
- frozen_moderation;
- closed.

Regola primaria:

- una chat e attiva solo se la distanza tra i due utenti e inferiore alla soglia applicabile.

Comportamento quando gli utenti si allontanano:

- lo storico resta visibile;
- input messaggio disabilitato;
- stato UI: chat sospesa;
- nessun nuovo messaggio consentito lato client e lato RLS/API;
- notifica opzionale quando torna attiva.

Comportamento quando tornano vicini:

- chat riattivata automaticamente;
- input messaggio abilitato;
- notifica "chat riattivata" o "siete di nuovo vicini".

Criteri:

- la validazione distanza deve avvenire lato backend/database;
- il client non e fonte di verita;
- messaggi inviati offline devono essere accodati e sincronizzati solo se la chat risulta ancora attiva al momento della sync.

### 5.9 Cronologia aree visitate

Ogni area conserva:

- nome area;
- citta;
- tipo luogo;
- periodo visita;
- post creati;
- commenti;
- connessioni;
- data ultima attivita.

Regole:

- l'area e una generalizzazione geografica, non una traccia precisa;
- l'utente puo consultare la propria cronologia;
- l'utente puo richiedere eliminazione dei dati;
- la cronologia supporta la consultazione dei contenuti storici consentiti.

### 5.10 Reputazione

Badge MVP:

- Utente affidabile;
- Ha aiutato qualcuno;
- Informazioni verificate;
- Esperto locale.

Segnali possibili:

- post non segnalati;
- commenti utili;
- richieste accettate;
- segnalazioni confermate o respinte;
- anzianita account;
- contributi in aree specifiche.

Regole:

- la reputazione non deve esporre dati sensibili;
- badge revocabili;
- reputazione usata per ordinamento leggero, non per discriminare accesso base.

### 5.11 Heatmap

Funzionalita:

- mostrare zone molto attive;
- mostrare zone poco attive;
- filtrare per finestra temporale;
- non mostrare utenti precisi.

Regole:

- solo dati aggregati;
- soglia minima di anonimato per cella/area;
- nessun marker di persona;
- nessuna coordinata personale esposta.

### 5.12 Moderazione e sicurezza contenuti

Funzionalita MVP:

- blocco utente;
- segnalazione utente;
- segnalazione post;
- segnalazione commento/messaggio;
- rate limiting;
- filtro linguaggio offensivo;
- predisposizione shadow ban;
- anti spam.

Regole:

- un blocco e reciproco per la visibilita/interazione nell'MVP;
- segnalazioni multiple alzano priorita revisione;
- utenti sospetti possono essere limitati prima della revisione manuale;
- tutti gli eventi moderativi rilevanti finiscono in audit log.

### 5.13 Notifiche push

Eventi:

- nuovo commento;
- richiesta privata ricevuta;
- richiesta accettata;
- chat riattivata;
- utenti tornano vicini;
- nuovo post rilevante nelle vicinanze.

Regole:

- notifiche richiedono consenso;
- token push associati a device;
- notifiche geolocalizzate devono rispettare raggio e privacy;
- non inviare coordinate o contenuti sensibili nel payload.

### 5.14 Offline e sincronizzazione

Funzionalita:

- cache feed recente;
- lettura chat storica;
- coda azioni offline;
- sincronizzazione al ritorno online.

Regole:

- creazione post offline consentita solo come bozza/coda;
- pubblicazione effettiva richiede GPS valido al momento della sync;
- invio messaggi offline consentito come pending locale;
- messaggi pending vengono inviati solo se chat attiva alla sync;
- conflitti risolti lato server con timestamp e stato corrente.

### 5.15 Analytics anonime

Metriche:

- numero post;
- numero commenti;
- tempo medio utilizzo;
- aree piu attive;
- retention;
- conversione richiesta privata -> chat;
- frequenza chat frozen/reactivated.

Regole:

- analytics aggregate;
- nessuna coordinata personale in analytics client-readable;
- opt-out dove richiesto;
- separazione tra audit di sicurezza e analytics prodotto.

### 5.16 GDPR

Funzionalita:

- consenso geolocalizzazione;
- consenso notifiche;
- privacy policy;
- esportazione dati;
- eliminazione dati;
- eliminazione account.

Regole:

- cancellazione account deve revocare accesso e avviare eliminazione/anonimizzazione dati;
- esportazione deve includere profilo, post, commenti, messaggi, richieste, cronologia aree, consensi;
- dati di audit possono avere retention separata se necessaria per sicurezza/obblighi legali.

## 6. Flussi utente principali

### 6.1 Onboarding

1. Utente apre app.
2. Vede valore del prodotto.
3. Accetta privacy/termini.
4. Crea account o accede.
5. Completa profilo.
6. Concede GPS.
7. Sceglie raggio.
8. Accede al feed locale.

### 6.2 Pubblicazione post

1. Utente apre composer.
2. Sceglie categoria.
3. Scrive testo.
4. Sceglie durata.
5. App verifica GPS, fiducia posizione e rate limit.
6. Backend salva post con posizione PostGIS.
7. Feed realtime aggiorna utenti vicini.
8. Notifiche inviate se rilevanti.

### 6.3 Commento

1. Utente apre post vicino.
2. Legge commenti.
3. Inserisce commento.
4. Sistema verifica prossimita, stato post e moderazione.
5. Commento pubblicato.
6. Autore post riceve notifica.

### 6.4 Connessione privata

1. Utente parte da post/commento.
2. Tocca richiesta privata.
3. Sistema verifica interazione pubblica e prossimita.
4. Destinatario riceve richiesta.
5. Destinatario accetta o rifiuta.
6. Se accetta, chat creata.

### 6.5 Chat sospesa e riattivata

1. Due utenti chattano mentre sono vicini.
2. Uno o entrambi si allontanano oltre soglia.
3. Backend aggiorna stato chat a frozen_distance.
4. Client disabilita input.
5. Storico resta leggibile.
6. Utenti tornano entro soglia.
7. Backend aggiorna stato chat ad active.
8. Client riabilita input e invia notifica.

### 6.6 Cronologia area

1. Utente apre cronologia.
2. Vede lista aree visitate.
3. Seleziona area.
4. Vede attivita storiche consentite.
5. Puo eliminare dati associati dove previsto.

## 7. Requisiti di schermata MVP

Schermate mobile:

- Splash/boot session;
- Onboarding;
- Login;
- Registrazione;
- Recupero password;
- Creazione profilo;
- Permessi GPS/notifiche;
- Feed locale;
- Composer post;
- Dettaglio post;
- Commenti;
- Richieste private;
- Chat list;
- Chat detail;
- Stato chat sospesa;
- Cronologia aree;
- Heatmap;
- Profilo;
- Modifica profilo;
- Impostazioni privacy;
- Export/delete account;
- Segnalazione contenuto;
- Blocco utente.

Schermate web non primarie:

- landing page;
- download;
- privacy policy;
- FAQ;
- documentazione;
- admin panel predisposto.

## 8. Requisiti dati MVP

Entita richieste:

- User/Auth;
- Profile;
- Location;
- Area;
- Post;
- Comment;
- ConnectionRequest;
- PrivateChat;
- PrivateMessage;
- Notification;
- Reputation;
- Report;
- AreaHistory;
- Device;
- PushToken;
- AuditLog.

Relazioni chiave:

- User 1:1 Profile;
- User 1:N Location;
- User 1:N Post;
- Post 1:N Comment;
- Post 1:N ConnectionRequest;
- ConnectionRequest 0:1 PrivateChat;
- PrivateChat 1:N PrivateMessage;
- User 1:N Device;
- Device 1:N PushToken;
- User 1:N AreaHistory;
- Area 1:N Post;
- User 1:N Report come reporter;
- Report N:1 target polimorfico o tabelle target dedicate.

## 9. Requisiti API e realtime

API REST/Edge Functions:

- auth/profile bootstrap;
- update profile;
- upload avatar;
- update location;
- get nearby feed;
- create post;
- create comment;
- create connection request;
- respond connection request;
- send private message;
- sync offline actions;
- register push token;
- report content/user;
- block user;
- export data;
- delete account.

Realtime:

- nuovi post vicini;
- nuovi commenti su post osservati;
- richieste private;
- stato richiesta;
- messaggi chat;
- stato chat active/frozen;
- notifiche in-app.

## 10. Requisiti non funzionali

### 10.1 Scalabilita

Target progettuale:

- oltre 100.000 utenti contemporanei;
- query geografiche indicizzate con PostGIS;
- paginazione obbligatoria;
- caching lato client con TanStack Query;
- feed ottimizzato per raggio e tempo;
- realtime limitato a canali pertinenti.

### 10.2 Sicurezza

Richiesto:

- RLS su tutte le tabelle sensibili;
- JWT;
- HTTPS;
- refresh token;
- rate limiting;
- protezione Edge Functions;
- audit log;
- validazioni server-side;
- storage avatar con policy dedicate.

### 10.3 Accessibilita

Richiesto:

- dark mode e light mode;
- contrasto leggibile;
- font scalabile;
- label accessibili;
- touch target adeguati;
- stati vuoti e di errore chiari.

### 10.4 Performance mobile

Richiesto:

- immagini avatar compresse;
- liste virtualizzate;
- cache e invalidazione controllata;
- sync incrementale;
- riduzione payload realtime;
- caricamento progressivo.

## 11. Regole di business MVP

- BR-001: un utente senza GPS valido non puo vedere il feed locale.
- BR-002: un post e visibile solo entro raggio e prima della scadenza, salvo cronologia storica consentita.
- BR-003: un post non puo durare oltre 24 ore nell'MVP.
- BR-004: una richiesta privata richiede almeno una interazione pubblica precedente.
- BR-005: una chat accetta nuovi messaggi solo se active.
- BR-006: lo stato active di una chat deve essere deciso lato backend/database.
- BR-007: coordinate GPS non devono mai essere mostrate nel client.
- BR-008: utenti bloccati non possono vedersi o interagire.
- BR-009: contenuti segnalati possono essere nascosti o limitati.
- BR-010: azioni offline vengono rivalidate alla sincronizzazione.
- BR-011: notifiche push richiedono consenso e token valido.
- BR-012: heatmap usa solo dati aggregati e anonimizzati.
- BR-013: ogni azione sensibile deve produrre audit log.
- BR-014: location trust score basso limita azioni geolocalizzate.
- BR-015: eliminazione account deve impedire nuovi accessi e avviare data deletion.

## 12. Criteri di accettazione MVP

### Autenticazione e profilo

- Un nuovo utente puo registrarsi, accedere e completare il profilo.
- Un utente puo aggiornare display name, bio e avatar.
- Un utente puo eliminare l'account.

### Feed e post

- Un utente con GPS valido vede solo post entro il raggio scelto.
- Un utente non vede coordinate precise.
- Un utente puo pubblicare post con categoria e scadenza.
- Un post scaduto non compare nel feed attivo.

### Commenti e connessioni

- Un utente vicino puo commentare un post attivo.
- Da un commento o post puo partire una richiesta privata.
- Il destinatario puo accettare o rifiutare.

### Chat

- Una chat accettata e utilizzabile se gli utenti sono vicini.
- Quando la distanza supera la soglia, la chat viene congelata.
- Lo storico resta leggibile.
- L'invio messaggi e impedito lato client e lato backend.
- Quando gli utenti tornano vicini, la chat si riattiva.

### Cronologia

- L'utente vede le aree visitate con dati generalizzati.
- L'utente non vede tracciati GPS precisi.

### Moderazione

- Un utente puo bloccare un altro utente.
- Un utente puo segnalare post, commenti o utenti.
- Rate limit e filtro offensivo impediscono abuso basilare.

### GDPR

- L'utente puo gestire consensi.
- L'utente puo richiedere export dati.
- L'utente puo richiedere eliminazione dati/account.

## 13. Fuori scope MVP

Non inclusi nella prima versione pubblicabile:

- follower, amicizie o contatti permanenti;
- feed globale;
- ricerca utenti globale;
- messaggi vocali;
- videochiamate;
- pagamenti;
- ranking complessi;
- moderazione AI avanzata completa;
- admin panel completo;
- social login multipli se rallentano la pubblicazione;
- web app pubblica sostitutiva della mobile app.

## 14. Rischi prodotto e mitigazioni

### Rischio: spoofing posizione

Mitigazione:

- location trust score;
- segnali device;
- salti impossibili;
- limitazione azioni sensibili;
- audit.

### Rischio: abuso o molestie

Mitigazione:

- blocco;
- report;
- rate limiting;
- richiesta privata solo dopo interazione pubblica;
- audit;
- shadow ban predisposto.

### Rischio: esposizione privacy geografica

Mitigazione:

- coordinate mai mostrate;
- distanze approssimate;
- aree generalizzate;
- heatmap aggregata;
- RLS e policy severe.

### Rischio: realtime troppo costoso

Mitigazione:

- canali per area/post/chat;
- payload minimi;
- paginazione;
- cache;
- invalidazione mirata.

### Rischio: UX complessa

Mitigazione:

- flussi guidati;
- stati chiari per GPS/chat sospesa;
- linguaggio semplice;
- schermate mobile-first.

## 15. Decisioni preliminari

- Stack confermato: React Native, Expo, TypeScript, Expo Router, Zustand, TanStack Query, React Hook Form, NativeWind, Supabase, PostgreSQL/PostGIS, Realtime, Edge Functions, Storage, RLS, Expo Push Notifications.
- Mappa consigliata per MVP: Mapbox, per heatmap e controllo avanzato dello stile mobile. La decisione tecnica finale verra formalizzata nello STEP 2.
- Fonte di verita per prossimita: backend/database con PostGIS, non client.
- Prodotto primario: app mobile. Web solo supporto, policy, documentazione, admin.

## 16. Output STEP 1

Questo documento definisce il perimetro funzionale dell'MVP e sara usato come input per:

- STEP 2 - Architettura;
- STEP 3 - Database;
- STEP 4 - Backend;
- STEP 5 - Frontend;
- STEP 6 - Realtime;
- STEP 7 - Geolocalizzazione;
- STEP 8 - Chat;
- STEP 9 - Testing;
- STEP 10 - Deployment.

## 17. Gate per procedere

Prima dello STEP 2 servono conferma o correzioni su:

- perimetro MVP;
- regole chat geofenced;
- scelta preliminare Mapbox;
- gestione cronologia aree;
- fuori scope MVP.

