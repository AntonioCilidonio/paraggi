import Constants from "expo-constants";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { demoMode } from "@/config/env";
import { supabase } from "@/services/supabase";

type ClientLogInput = {
  severity?: "debug" | "info" | "warning" | "error" | "fatal";
  source: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
};

let installed = false;

function normalizeError(error: unknown) {
  if (error instanceof Error) return { message: error.message, stack: error.stack };
  if (typeof error === "string") return { message: error };
  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: "Unknown error" };
  }
}

export async function logClientEvent(input: ClientLogInput) {
  if (demoMode) {
    console.warn("[Paraggi client event]", input);
    return;
  }

  try {
    await supabase.functions.invoke("log-client-event", {
      body: {
        severity: input.severity ?? "error",
        source: input.source,
        message: input.message,
        stack: input.stack,
        context: input.context ?? {},
        appVersion: Constants.expoConfig?.version,
        platform: Platform.OS,
        deviceModel: Device.modelName,
        osVersion: Device.osVersion
      }
    });
  } catch (error) {
    console.warn("[Paraggi logger failed]", error);
  }
}

export function captureClientError(source: string, error: unknown, context?: Record<string, unknown>, severity: ClientLogInput["severity"] = "error") {
  const normalized = normalizeError(error);
  void logClientEvent({
    severity,
    source,
    message: normalized.message,
    stack: normalized.stack,
    context
  });
}

export function installGlobalErrorLogger() {
  if (installed) return;
  installed = true;

  const maybeGlobal = globalThis as typeof globalThis & {
    ErrorUtils?: {
      getGlobalHandler?: () => (error: Error, isFatal?: boolean) => void;
      setGlobalHandler?: (handler: (error: Error, isFatal?: boolean) => void) => void;
    };
  };

  const previousHandler = maybeGlobal.ErrorUtils?.getGlobalHandler?.();
  maybeGlobal.ErrorUtils?.setGlobalHandler?.((error, isFatal) => {
    captureClientError("global_error", error, { isFatal }, isFatal ? "fatal" : "error");
    previousHandler?.(error, isFatal);
  });
}
