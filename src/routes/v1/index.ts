import express from 'express';
import HealthRouter from "./health";
import authRoutes from "./auth";
import adminRoutes from "./admin";
import userRoutes from "./api";
import { auth } from "../../middlewares/auth";
import { authorise } from "../../middlewares/authorise";
import { maintenance } from '../../middlewares/maintenance';

const router = express.Router();

//router.use("/api/v1", HealthRouter);
router.use("/api/v1", maintenance, authRoutes);
router.use("/api/v1/users", maintenance, userRoutes);
router.use("/api/v1/admins", maintenance, auth, authorise(true, "ADMIN"), adminRoutes);

export default router;
