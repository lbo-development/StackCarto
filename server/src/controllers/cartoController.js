import { supabase } from "../lib/supabase.js";
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

export async function getMapLayers(req, res) {
  try {
    const { type, id } = req.query;

    if (!type || !id) {
      return res.status(400).json({
        message: "Paramètres type et id requis.",
      });
    }

    if (!["service", "site", "installation"].includes(type)) {
      return res.status(400).json({
        message: "Type invalide.",
      });
    }

    let supportsQuery = supabase
      .from("supports_calques")
      .select(
        "id_support_calque, type_support, id_service, id_site, id_installation",
      )
      .eq("type_support", type);

    if (type === "service") {
      supportsQuery = supportsQuery.eq("id_service", id);
    } else if (type === "site") {
      supportsQuery = supportsQuery.eq("id_site", id);
    } else if (type === "installation") {
      supportsQuery = supportsQuery.eq("id_installation", id);
    }

    const { data: supports, error: supportsError } = await supportsQuery;

    if (supportsError) {
      console.error("Erreur supports_calques :", supportsError);
      return res.status(500).json({
        message: "Erreur récupération supports_calques",
        details: supportsError.message,
      });
    }

    if (!supports || supports.length === 0) {
      return res.status(200).json([]);
    }

    const supportIds = supports.map((row) => row.id_support_calque);

    const { data: layers, error: layersError } = await supabase
      .from("calques")
      .select(
        `
        id_calque,
        id_support_calque,
        code_calque,
        lib_calque,
        description_calque,
        type_entite,
        ordre_calque,
        visible_defaut,
        actif
      `,
      )
      .in("id_support_calque", supportIds)
      .eq("actif", true)
      .order("ordre_calque", { ascending: true, nullsFirst: false })
      .order("lib_calque", { ascending: true });

    if (layersError) {
      console.error("Erreur calques :", layersError);
      return res.status(500).json({
        message: "Erreur récupération calques",
        details: layersError.message,
      });
    }

    return res.status(200).json(layers ?? []);
  } catch (error) {
    console.error("Erreur map-layers :", error);
    return res.status(500).json({
      message: "Erreur récupération calques",
      details: error.message,
    });
  }
}
