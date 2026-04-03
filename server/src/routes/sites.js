import express from "express";
import { fetchSites } from "../controllers/sitesController.js";

const router = express.Router();

router.get("/", fetchSites);

export default router;
