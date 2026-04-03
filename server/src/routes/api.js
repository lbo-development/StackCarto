import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

router.get("/items", async (req, res) => {
  try {
    const { data, error } = await supabase.from("services").select("*");

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
