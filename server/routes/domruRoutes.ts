import express from "express";
import authRoutes from "./authRoutes.js";
import devicesRoutes from "./devicesRoutes.js";
import streamRoutes from "./streamRoutes.js";
import doorRoutes from "./doorRoutes.js";
import eventsRoutes from "./eventsRoutes.js";
import peopleRoutes from "./peopleRoutes.js";

const router = express.Router();

router.use("/", authRoutes);
router.use("/", devicesRoutes);
router.use("/", streamRoutes);
router.use("/", doorRoutes);
router.use("/", eventsRoutes);
router.use("/", peopleRoutes);

export default router;
