import { getCartoTree } from "../services/cartoService.js";

export async function getTree(req, res) {
  try {
    const tree = await getCartoTree();
    res.status(200).json(tree);
  } catch (error) {
    console.error("Erreur carto :", error);
    res.status(500).json({
      message: "Erreur récupération arborescence",
      details: error.message,
    });
  }
}
