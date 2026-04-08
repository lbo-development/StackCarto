import express from "express";
import { getTree, getMapLayers } from "../controllers/cartoController.js";

const router = express.Router();

router.get("/tree", getTree);
router.get("/map-layers", getMapLayers);
export default router;
