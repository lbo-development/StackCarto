import { supabase } from "../lib/supabase.js";

export async function getCartoTree() {
  const { data, error } = await supabase.rpc("get_carto_tree_json");

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}
