import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import apiRoutes from "./routes/api.js";
import sitesRoutes from "./routes/sites.js";
import servicesRoutes from "./routes/services.js";
import cartoRoutes from "./routes/carto.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "API Express OK" });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", apiRoutes);

app.use("/api/sites", sitesRoutes);
app.use("/api/services", servicesRoutes);
app.use("/api/carto", cartoRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
