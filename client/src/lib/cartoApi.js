const rawApiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";

function normalizeApiBaseUrl(url) {
  if (!url) return "http://localhost:4000";

  const trimmed = url.trim().replace(/\/+$/, "");

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

const API_BASE_URL = normalizeApiBaseUrl(rawApiBaseUrl);

export async function fetchCartoTree() {
  const url = `${API_BASE_URL}/api/carto/tree`;

  console.log("Appel API carto :", url);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erreur HTTP ${response.status} - ${text}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}
export async function fetchLayers(type, id) {
  const url = `${API_BASE_URL}/api/map-layers?type=${type}&id=${id}`;

  const response = await fetch(url);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erreur HTTP ${response.status} - ${text}`);
  }

  return response.json();
}

export async function fetchLayerObjects(id_calque) {
  const url = `${API_BASE_URL}/api/map-layer-objects?id_calque=${id_calque}`;

  const response = await fetch(url);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erreur HTTP ${response.status} - ${text}`);
  }

  return response.json();
}
