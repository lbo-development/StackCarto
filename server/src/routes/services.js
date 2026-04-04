import express from "express";
import { fetchServices } from "../controllers/servicesController.js";

const router = express.Router();

router.get("/", fetchServices);

export default router;
