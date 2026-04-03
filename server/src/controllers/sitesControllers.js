import { getAllSites } from "../services/sitesService.js";

export const fetchSites = async (req, res) => {
  try {
    const sites = await getAllSites();
    res.json(sites);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
