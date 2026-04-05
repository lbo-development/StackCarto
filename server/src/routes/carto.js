import express from "express";
import { getTree } from "../controllers/cartoController.js";

const router = express.Router();

router.get("/tree", getTree);

export default router;
