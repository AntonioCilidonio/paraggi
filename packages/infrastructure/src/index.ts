export type SupabaseEnvironment = {
  readonly url: string;
  readonly anonKey: string;
};

export type EdgeFunctionName =
  | "update-location"
  | "create-post"
  | "create-comment"
  | "request-connection"
  | "respond-connection"
  | "send-private-message"
  | "sync-offline-actions"
  | "register-push-token"
  | "export-account-data"
  | "delete-account";

