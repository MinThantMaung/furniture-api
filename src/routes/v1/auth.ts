import express from "express";
import {
  register,
  varifyOtp,
  confirmPassword,
  login,
} from "../../controllers/authController";

const router = express.Router();

router.post("/register", register);
router.post("/varify-otp", varifyOtp);
router.post("/confirm-password", confirmPassword);
router.post("/login", login);

export default router;
