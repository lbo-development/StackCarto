import { getAllServices } from "../services/servicesService.js";

export const fetchServices = async (req, res) => {
  try {
    const services = await getAllServices();
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
