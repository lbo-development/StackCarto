import express from "express";
import { supabase } from "../lib/supabase.js";
import cartoRoutes from "./carto.js";
const router = express.Router();

router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

router.use("/carto", cartoRoutes);
export default router;
