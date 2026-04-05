const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export async function fetchCartoTree() {
  const response = await fetch(`${API_BASE_URL}/api/carto/tree`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Erreur HTTP ${response.status}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}
