const messages: Record<string, string> = {
  invalid_credentials: "Email o password non corretti.",
  permission_denied:
    "Permesso GPS negato. Abilitalo dalle impostazioni del telefono.",
  location_unavailable:
    "GPS non disponibile. Riprova all'aperto o controlla i permessi.",
  valid_location_required:
    "Prima di pubblicare serve una posizione GPS valida.",
  location_insert_failed:
    "Non sono riuscito a salvare la posizione. Riprova tra qualche secondo.",
  post_insert_failed: "Non sono riuscito a pubblicare il post. Riprova.",
  nearby_feed_failed:
    "Non riesco a caricare i post vicini. Aggiorna il GPS e riprova.",
  requests_failed: "Non riesco a caricare le richieste private.",
  chats_failed: "Non riesco a caricare le chat.",
  chat_id_required: "Questa chat non ha un identificativo valido.",
  chat_status_failed:
    "Non riesco a verificare la distanza della chat. Aggiorna il GPS e riprova.",
  messages_failed: "Non riesco a caricare i messaggi. Riprova.",
  chat_not_found: "Chat non trovata o non piu disponibile.",
  chat_disconnected:
    "Questa connessione e stata rimossa. Puoi richiederla di nuovo da un post della persona.",
  disconnect_chat_failed:
    "Non sono riuscito a rimuovere la connessione. Riprova.",
  post_not_visible:
    "Il post e scaduto, e stato rimosso o non e piu disponibile.",
  post_detail_failed:
    "Non riesco a caricare il post. Riprova tra qualche secondo.",
  post_not_commentable: "Questo post non puo piu ricevere commenti.",
  create_comment_failed: "Commento non salvato. Riprova.",
  invalid_comment_rating: "Valutazione non valida.",
  comment_not_found: "Questo commento non e piu disponibile.",
  comment_rating_not_allowed: "Solo l'autore del post puo valutare i commenti ricevuti.",
  cannot_rate_own_comment: "Non puoi valutare un tuo commento.",
  comment_rating_failed: "Valutazione non salvata. Riprova.",
  missing_post_id: "Post non valido. Torna al feed e riapri la conversazione.",
  cannot_request_self: "Non puoi aprire una richiesta privata con te stesso.",
  request_connection_failed: "Richiesta privata non creata. Riprova.",
  recipient_required: "Persona da contattare non valida.",
  connection_post_invalid:
    "Il post di origine non e valido per questa richiesta.",
  reconnect_chat_not_found:
    "La connessione da ripristinare non e piu disponibile.",
  reconnect_not_allowed: "Non puoi ripristinare questa connessione.",
  reconnect_source_missing:
    "Non riesco a recuperare la conversazione originale.",
  request_not_respondable: "Questa richiesta non e piu accettabile.",
  request_lookup_failed: "Non riesco a verificare questa richiesta. Riprova.",
  request_update_failed: "La richiesta non e stata aggiornata. Riprova.",
  create_chat_failed: "Chat non creata. Riprova.",
  chat_not_active: "Chat sospesa: tornate vicini per inviare messaggi.",
  message_content_required: "Scrivi un messaggio oppure aggiungi un allegato.",
  message_too_long: "Il messaggio e troppo lungo. Riduci il testo e riprova.",
  invalid_attachment_kind: "Questo tipo di allegato non e supportato.",
  invalid_attachment_path: "L'allegato non appartiene a questa conversazione.",
  attachment_not_uploaded: "L'allegato non e stato caricato. Riprova.",
  send_message_failed: "Messaggio non inviato. Riprova.",
  edge_function_unavailable:
    "Il servizio non risponde in questo momento. Controlla la rete e riprova.",
  invalid_coordinates: "La posizione GPS non e valida. Aggiornala e riprova.",
  sos_temporarily_blocked:
    "La funzione SOS e temporaneamente sospesa dopo segnalazioni confermate di falso allarme.",
  sos_already_active:
    "Hai gia un SOS attivo. Attendi o concludi quello precedente.",
  cannot_review_own_sos: "Non puoi valutare il tuo stesso SOS.",
  invalid_danger_feedback: "Valutazione SOS non valida.",
  danger_feedback_failed: "Valutazione SOS non salvata. Riprova.",
  media_too_large: "L'allegato e troppo grande. Scegli un file piu leggero.",
  media_upload_failed:
    "Allegato non caricato. Riprova con un file piu leggero.",
  area_history_failed: "Non riesco a caricare la cronologia aree.",
  area_detail_failed: "Non riesco a caricare le attivita di quest'area.",
  area_not_found: "Quest'area non e piu disponibile nella tua cronologia.",
  area_id_required: "Area non valida. Torna alla cronologia e riprova.",
  heatmap_failed:
    "Non riesco a caricare la heatmap. Aggiorna il GPS e riprova.",
  email_rate_limit_exceeded:
    "Troppe email di registrazione inviate in poco tempo. Attendi qualche minuto oppure disattiva temporaneamente la conferma email in Supabase per i test.",
  unauthorized: "Sessione non valida. Accedi di nuovo.",
  unauthenticated: "Sessione non valida. Accedi di nuovo.",
};

export function getFriendlyError(
  error: unknown,
  fallback = "Operazione non riuscita. Riprova.",
): string {
  if (!error) return fallback;
  if (typeof error === "string") return messages[error] ?? error;

  if (typeof error === "object") {
    const value = error as {
      message?: string;
      error?: string;
      details?: string;
    };
    const key = value.error ?? value.message;
    if (key && messages[key]) return messages[key];
    if (value.message?.includes("Invalid login credentials"))
      return messages.invalid_credentials;
    if (value.message?.toLowerCase().includes("email rate limit exceeded"))
      return messages.email_rate_limit_exceeded;
    if (value.error?.toLowerCase().includes("email rate limit exceeded"))
      return messages.email_rate_limit_exceeded;
    if (value.message?.includes("Edge Function returned a non-2xx"))
      return messages.edge_function_unavailable;
    if (value.details && !value.details.toLowerCase().includes("sql"))
      return value.details;
    if (value.message) return value.message;
  }

  return fallback;
}
