import { Platform } from "react-native";

export function getApiBase(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}/api`;
  }
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (configured) return configured;
  return "/api";
}

export async function apiFetch<T>(path: string): Promise<T> {
  const url = `${getApiBase()}${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error ${res.status}: ${url}`);
  return res.json() as Promise<T>;
}
