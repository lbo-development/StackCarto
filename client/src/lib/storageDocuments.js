import { supabase } from "./supabase";

const DOCUMENTS_BUCKET = "documents_services";

function normalizeStoragePath(path) {
  const raw = String(path || "")
    .trim()
    .replace(/^\/+/, "");
  if (!raw) return "";

  // Cas 1 : déjà sous la forme "documents/monfichier.pdf"
  if (raw.startsWith("documents/")) {
    return raw;
  }

  // Cas 2 : path_file contient déjà le bucket "documents_services/documents/..."
  if (raw.startsWith(`${DOCUMENTS_BUCKET}/`)) {
    return raw.slice(DOCUMENTS_BUCKET.length + 1);
  }

  // Cas 3 : simple nom ou sous-chemin -> on force sous documents/
  return `documents/${raw}`;
}

export function getPublicDocumentUrl(pathFile) {
  const normalizedPath = normalizeStoragePath(pathFile);

  if (!normalizedPath) {
    return "";
  }

  const { data } = supabase.storage
    .from(DOCUMENTS_BUCKET)
    .getPublicUrl(normalizedPath);

  return data?.publicUrl || "";
}

export { normalizeStoragePath, DOCUMENTS_BUCKET };
