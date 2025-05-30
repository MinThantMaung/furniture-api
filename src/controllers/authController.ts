import { NextFunction, Request, Response } from "express";
import { body, validationResult } from "express-validator";
import {
  createOtp,
  getOtpByPhone,
  getUserByPhone,
  updateOtp,
} from "../services/authServices";
import {
  checkOtpErrorIfSameDate,
  checkOtpRow,
  checkUserExist,
} from "../utils/auth";
import { generateOTP, generateToken } from "../utils/generate";
import * as bcrypt from "bcrypt";
import moment from "moment";

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

    let phone = req.body.phone;
    if (phone.slice(0, 2) === "09") {
      phone = phone.substring(2, phone.length);
    }
    //get user phone from prisma
    const user = await getUserByPhone(phone);

    //check if user is already exist
    checkUserExist(user);

    const otp = "123456"; //for testing
    //generate OTP
    // const otp = generateOTP(); //for production
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otp.toString(), salt);
    const token = generateToken();

    //check first time otp or registered in otp table
    const otpRow = await getOtpByPhone(phone);
    let result;
    if (!otpRow) {
      //insert into database
      const otpData = {
        phone,
        otp: hashedOtp,
        rememberToken: token,
        count: 1,
      };
      result = await createOtp(otpData);
    } else {
      const lastOtpRequest = new Date(otpRow.updatedAt).toLocaleDateString();
      const today = new Date().toLocaleDateString();
      const isSameDate = lastOtpRequest === today;
      checkOtpErrorIfSameDate(isSameDate, otpRow.error);
      if (!isSameDate) {
        const otpData = {
          otp: hashedOtp,
          rememberToken: token,
          count: 1,
          error: 0,
        };
        result = await updateOtp(otpRow.id, otpData);
      } else {
        if (otpRow.count === 3) {
          const error: any = new Error(
            "Otp is allowed to request 3 times per day!."
          );
          error.status = 405;
          error.code = "Error_LimitExceed";
          return next(error);
        } else {
          const otpData = {
            otp: hashedOtp,
            rememberToken: token,
            count: {
              increment: 1,
            },
          };
          result = await updateOtp(otpRow.id, otpData);
        }
      }
    }

    res.status(200).json({
      message: `We are sending OTP to 09${result.phone}`,
      phone: result.phone,
      token: result.rememberToken,
    });
  },
];

export const varifyOtp = [
  body("phone", "Invalid phone number")
    .trim()
    .notEmpty()
    .withMessage("Phone number cannot be empty.")
    .matches("^[0-9]+$")
    .withMessage("Please enter only number.")
    .isLength({ min: 5, max: 12 })
    .withMessage("Phone number is between 2 and 12 digits."),
  body("otp", "Invalid otp")
    .trim()
    .notEmpty()
    .matches("^[0-9]+$")
    .isLength({ min: 6, max: 6 }),
  body("token", "Invalid Token").trim().notEmpty().escape(),
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req).array({ onlyFirstError: true });
    if (errors.length > 0) {
      const error: any = new Error(errors[0].msg);
      error.status = 400;
      error.code = "Error_Invalid";
      return next(error);
    }

    const { phone, otp, token } = req.body;
    const user = await getUserByPhone(phone);
    checkUserExist(user);

    const otpRow = await getOtpByPhone(phone);
    checkOtpRow(otpRow);

    //if otp verify is in the same date and over limit
    const lastOtpVerify = new Date(otpRow!.updatedAt).toLocaleDateString();
    const today = new Date().toLocaleDateString();
    const isSameDate = lastOtpVerify === today;
    checkOtpErrorIfSameDate(isSameDate, otpRow!.error);
    let result;

    //check token is same and if error set error to 5
    if (otpRow?.rememberToken !== token) {
      const otpData = {
        error: 5,
      };

      result = await updateOtp(otpRow!.id, otpData);
      const error: any = new Error("Invalid Token");
      error.status = 400;
      error.code = "Error_Invalid";
      return next(error);
    }

    const isExpired = moment().diff(otpRow?.updatedAt, "minutes") > 2;
    if (isExpired) {
      const error: any = new Error("Otp expired!.");
      error.status = 403;
      error.code = "Error_Expired ";
      return next(error);
    }

    //check otp is valid
    const isMatchOtp = await bcrypt.compare(otp, otpRow!.otp);
    //otp wrong
    if (!isMatchOtp) {
      //if otp error is first time
      if (!isSameDate) {
        const otpData = {
          error: 1,
        };
        await updateOtp(otpRow!.id, otpData);
      } else {
        //if otp error not first time today
        const otpData = {
          error: { increment: 1 },
        };
        await updateOtp(otpRow!.id, otpData);
      }
      const error: any = new Error("Otp is incorrect.");
      error.status = 401;
      error.code = "Error_Invalid ";
      return next(error);
    }

    //everything is fine
    const verifyToken = generateToken();
    const otpData = {
      verifyToken,
      error: 0,
      count: 1,
    };

    const otpResult = await updateOtp(otpRow!.id, otpData);

    res.status(200).json({
      message: "Otp is successfully verified!.",
      phone: otpResult.phone,
      token: otpResult.verifyToken,
    });
  },
];

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
