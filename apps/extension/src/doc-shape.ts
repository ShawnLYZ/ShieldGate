// Ambiguous long-form / structured text worth escalating to the backend context
// classifier (story 12) instead of fast-allowing. Kept in sync with the backend's
// classify.is_document_shaped so both sides agree on what escalates.
export function looksDocumentShaped(text: string): boolean {
  return text.length >= 200 || (text.match(/\n/g)?.length ?? 0) >= 3;
}
