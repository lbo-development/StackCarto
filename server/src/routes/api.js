import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

export default router;
