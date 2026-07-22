import { chatgptAdapter } from "./chatgpt";
import { claudeAdapter } from "./claude";
import { geminiAdapter } from "./gemini";
import { mockAdapter } from "./mock";
import type { SiteAdapter } from "./types";

export const ADAPTERS: SiteAdapter[] = [mockAdapter, chatgptAdapter, claudeAdapter, geminiAdapter];
export function pickAdapter(host: string): SiteAdapter | null {
  return ADAPTERS.find((a) => a.matches(host)) ?? null;
}
