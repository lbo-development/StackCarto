import { supabase } from "../lib/supabase.js";
import { getCartoTree } from "../services/cartoService.js";

function normalizeGeom(geom) {
  if (!geom) return null;

  if (typeof geom === "object") {
    return geom;
  }

  if (typeof geom === "string") {
    try {
      return JSON.parse(geom);
    } catch {
      return null;
    }
  }

  return null;
}

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
    actif,
    min_zoom,
    max_zoom,
    marker_type,
    marker_color,
    marker_icon_name,
    marker_icon_url,
    marker_size
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

export async function getLayerObjects(req, res) {
  try {
    const { layerIds } = req.body ?? {};

    if (!Array.isArray(layerIds)) {
      return res.status(400).json({
        message: "Le paramètre layerIds doit être un tableau.",
      });
    }

    const sanitizedLayerIds = layerIds
      .filter((value) => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean);

    if (sanitizedLayerIds.length === 0) {
      return res.status(200).json([]);
    }

    const { data, error } = await supabase
      .from("objets_geographiques")
      .select(
        `
        id_objet,
        id_calque,
        code_objet,
        lib_objet,
        description_objet,
        type_objet,
        geom,
        properties,
        style,
        ordre_affichage,
        actif
      `,
      )
      .in("id_calque", sanitizedLayerIds)
      .eq("actif", true)
      .order("ordre_affichage", { ascending: true, nullsFirst: false })
      .order("lib_objet", { ascending: true });

    if (error) {
      console.error("Erreur objets_geographiques :", error);
      return res.status(500).json({
        message: "Erreur récupération objets géographiques",
        details: error.message,
      });
    }

    const normalized = (data ?? []).map((item) => ({
      ...item,
      geom: normalizeGeom(item.geom),
    }));

    return res.status(200).json(normalized);
  } catch (error) {
    console.error("Erreur layer-objects :", error);
    return res.status(500).json({
      message: "Erreur récupération objets géographiques",
      details: error.message,
    });
  }
}
