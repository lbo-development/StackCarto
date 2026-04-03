import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL manquante dans server/.env");
}

if (!supabaseKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante dans server/.env");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
