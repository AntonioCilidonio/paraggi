const messages: Record<string, string> = {
  invalid_credentials: "Email o password non corretti.",
  permission_denied: "Permesso GPS negato. Abilitalo dalle impostazioni del telefono.",
  location_unavailable: "GPS non disponibile. Riprova all'aperto o controlla i permessi.",
  valid_location_required: "Prima di pubblicare serve una posizione GPS valida.",
  location_insert_failed: "Non sono riuscito a salvare la posizione. Riprova tra qualche secondo.",
  post_insert_failed: "Non sono riuscito a pubblicare il post. Riprova.",
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
