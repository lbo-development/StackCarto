import express from "express";
import {
  getTree,
  getMapLayers,
  getLayerObjects,
} from "../controllers/cartoController.js";

const router = express.Router();

router.get("/tree", getTree);
router.get("/map-layers", getMapLayers);
router.post("/layer-objects", getLayerObjects);

export default router;
