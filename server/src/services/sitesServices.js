import { supabase } from "../supabase.js";

export const getAllSites = async () => {
  const { data, error } = await supabase.from("sites").select("*");

  if (error) throw error;
  return data;
};
