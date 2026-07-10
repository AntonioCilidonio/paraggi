const messages: Record<string, string> = {
  invalid_credentials: "Email o password non corretti.",
  permission_denied: "Permesso GPS negato. Abilitalo dalle impostazioni del telefono.",
  location_unavailable: "GPS non disponibile. Riprova all'aperto o controlla i permessi.",
  valid_location_required: "Prima di pubblicare serve una posizione GPS valida.",
  location_insert_failed: "Non sono riuscito a salvare la posizione. Riprova tra qualche secondo.",
  post_insert_failed: "Non sono riuscito a pubblicare il post. Riprova.",
  nearby_feed_failed: "Non riesco a caricare i post vicini. Aggiorna il GPS e riprova.",
  requests_failed: "Non riesco a caricare le richieste private.",
  chats_failed: "Non riesco a caricare le chat.",
  chat_not_found: "Chat non trovata o non piu disponibile.",
  post_not_visible: "Post non visibile da questa posizione o non piu attivo.",
  post_not_commentable: "Questo post non puo piu ricevere commenti.",
  create_comment_failed: "Commento non salvato. Riprova.",
  missing_post_id: "Post non valido. Torna al feed e riapri la conversazione.",
  unauthorized: "Sessione non valida. Accedi di nuovo.",
  unauthenticated: "Sessione non valida. Accedi di nuovo."
};

export function getFriendlyError(error: unknown, fallback = "Operazione non riuscita. Riprova."): string {
  if (!error) return fallback;
  if (typeof error === "string") return messages[error] ?? error;

  if (typeof error === "object") {
    const value = error as { message?: string; error?: string; details?: string };
    const key = value.error ?? value.message;
    if (key && messages[key]) return messages[key];
    if (value.message?.includes("Invalid login credentials")) return messages.invalid_credentials;
    if (value.details) return value.details;
    if (value.message) return value.message;
  }

  return fallback;
}
