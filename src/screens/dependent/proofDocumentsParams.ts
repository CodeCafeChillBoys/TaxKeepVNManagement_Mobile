/** NPT-07: ưu tiên checklist từ PATCH response qua nav params. */

export function resolveProofDocumentsChecklist(options: {
  requiredDocuments?: string[] | null;
  fallbackDocTypes: string[];
}): string[] {
  const fromParams = options.requiredDocuments?.filter((d) => d && String(d).trim());
  if (fromParams && fromParams.length > 0) {
    return fromParams.map((d) => d.trim());
  }
  return options.fallbackDocTypes;
}
