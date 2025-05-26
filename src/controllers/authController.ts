import { NextFunction, Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { min } from "moment";

export const register = [
  body("phone", "Invalid phone number")
    .trim()
    .notEmpty()
    .withMessage("Phone number cannot be empty.")
    .matches("^[0-9]+$")
    .withMessage("Please enter only number.")
    .isLength({ min: 5, max: 12 })
    .withMessage("Phone number is between 2 and 12 digits."),
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req).array({ onlyFirstError: true });
    if (errors.length > 0) {
      const error: any = new Error(errors[0].msg);
      error.status = 400;
      error.code = "Error_Invalid";
      return next(error);
    }
    res.status(200).json({ message: "register success" });
  },
];

export const varifyOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.status(200).json({ message: "varifyOtp" });
};

export const confirmPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.status(200).json({ message: "confirmPassword" });
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.status(200).json({ message: "login" });
};
