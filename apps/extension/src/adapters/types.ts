export interface ToolDescriptor { domain: string; label: string; }
export interface SiteAdapter {
  id: string;
  matches(host: string): ToolDescriptor | null;
  getComposer(): HTMLTextAreaElement | HTMLElement | null;
  getComposerText(): string;
  setComposerText(text: string): void;
  onBeforeSend(handler: (text: string, release: () => void, cancel: () => void) => void): void;
  watchResponses(cb: (text: string, node: HTMLElement) => void): void;
  onCopy?(handler: (text: string) => void): void;
}
