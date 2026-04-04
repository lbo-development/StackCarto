import { supabase } from "../lib/supabase.js";

export const getAllServices = async () => {
  const { data, error } = await supabase.from("services").select("*");

  if (error) throw error;
  return data;
};
