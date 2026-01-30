import { Request, Response, NextFunction } from "express";
import { body, check, validationResult } from "express-validator";
import bcrypt from "bcrypt";
import {
  createOTP,
  createUser,
  getOtpByPhone,
  getUserById,
  getUserByPhone,
  updateOtp,
  updateUser,
} from "../services/authService";
import {
  checkOtpErrorIfSameDate,
  checkOtpRow,
  checkUserExist,
  checkUserIfNotExist,
} from "../utils/auth";
import { generateOTP, generateToken } from "../utils/generate";
import moment from "moment";
import jwt from "jsonwebtoken";
import { errorCode } from "../../config/errorCode";
import { createError } from "../utils/error";

export const register = [
  body("phone", "Invalid Phone Number")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required")
    .matches("^[0-9]+$")
    .withMessage("Phone number must contain only digits")
    .isLength({ min: 5, max: 12 })
    .withMessage("Phone number must be between 5 and 12 digits"),
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req).array({ onlyFirstError: true });
    if (errors.length > 0) {
      return next(createError(errors[0].msg, 400, errorCode.invalid));
    }

    let phone = req.body.phone;
    if (phone.slice(0, 2) === "09") {
      phone = phone.substring(2, phone.length);
    }
    const user = await getUserByPhone(phone);

    checkUserExist(user);

    //const otp = generateOTP();
    const otp = 123456; // TODO: Remove this line and uncomment the above line when in production
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otp.toString(), salt);
    const token = generateToken();

    const otpRow = await getOtpByPhone(phone);
    let result;
    if (!otpRow) {
      const otpData = {
        phone,
        otp: hashedOtp,
        rememberToken: token,
        count: 1,
      };
      result = await createOTP(otpData);
    } else {
      //get last update time
      const lastOtpRequest = new Date(otpRow.updatedAt).toLocaleDateString();
      const today = new Date().toLocaleDateString();
      const isSameDay = lastOtpRequest === today;
      checkOtpErrorIfSameDate(isSameDay, otpRow.error);

      if (!isSameDay) {
        const otpData = {
          otp: hashedOtp,
          rememberToken: token,
          count: 1,
          error: 0,
        };
        result = await updateOtp(otpRow.id, otpData);
      } else {
        if (otpRow.count === 5) {
          return next(
            createError(
              "You have reached the maximum number of OTP requests for today. Please try again tomorrow.",
              405,
              errorCode.overLimit
            )
          );
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
      message: `OTP  successfully sent to ${phone}!`,
      phone: result.phone,
      token: result.rememberToken,
    });
  },
];

export const verifyOtp = [
  body("phone", "Invalid Phone Number")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required")
    .matches("^[0-9]+$")
    .withMessage("Phone number must contain only digits")
    .isLength({ min: 5, max: 12 })
    .withMessage("Phone number must be between 5 and 12 digits"),
  body("otp", "Invalid OTP")
    .trim()
    .notEmpty()
    .withMessage("OTP is required")
    .matches("^[0-9]+$")
    .isLength({ min: 6, max: 6 }),
  body("token", "Invalid Token")
    .trim()
    .notEmpty()
    .withMessage("OTP is required")
    .escape(),
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req).array({ onlyFirstError: true });
    if (errors.length > 0) {
      return next(createError(errors[0].msg, 400, errorCode.invalid));
    }

    const { phone, otp, token } = req.body;
    const user = await getUserByPhone(phone);
    checkUserExist(user);

    const otpRow = await getOtpByPhone(phone);
    checkOtpRow(otpRow);

    // otp verify same date and over limit check
    const lastOtpVerify = new Date(otpRow!.updatedAt).toLocaleDateString();
    const today = new Date().toLocaleDateString();
    const isSameDay = lastOtpVerify === today;
    checkOtpErrorIfSameDate(isSameDay, otpRow!.error);

    let result;

    //if token not match
    if (otpRow?.rememberToken !== token) {
      const otpData = {
        error: 5,
      };
      await updateOtp(otpRow!.id, otpData);
      return next(createError("Invalid Token", 400, errorCode.invalid));
    }

    const isExpired = moment().diff(otpRow!.updatedAt, "minutes") > 2;

    if (isExpired) {
      return next(
        createError(
          "OTP has expired. Please request a new one.",
          403,
          errorCode.otpExpired
        )
      );
    }

    const isMatchOTP = await bcrypt.compare(otp, otpRow!.otp);

    if (!isMatchOTP) {
      //if  otp error is first time today
      if (!isSameDay) {
        const otpData = {
          error: 1,
        };
        await updateOtp(otpRow!.id, otpData);
      } else {
        //if otp error is not first time today
        const otpData = {
          error: {
            increment: 1,
          },
        };
        await updateOtp(otpRow!.id, otpData);
      }
      return next(createError("OTP is not correct!", 401, errorCode.invalid));
    }

    const verifyToken = generateToken();
    const optData = {
      verifyToken,
      error: 0,
      count: 1,
    };

    result = await updateOtp(otpRow!.id, optData);
    res.status(200).json({
      message: "OTP is Successfully Verifed!",
      phone: result.phone,
      token: result.verifyToken,
    });
  },
];

export const confirmPassword = [
  body("phone", "Invalid Phone Number")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required")
    .matches("^[0-9]+$")
    .withMessage("Phone number must contain only digits")
    .isLength({ min: 5, max: 12 })
    .withMessage("Phone number must be between 5 and 12 digits"),
  body("password", "Password must contain only digits and be 8 digits long")
    .trim()
    .notEmpty()
    .matches("^[0-9]+$")
    .isLength({ min: 8, max: 8 }),
  body("token", "Invalid Token").trim().notEmpty().escape(),
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req).array({ onlyFirstError: true });
    if (errors.length > 0) {
      return next(createError(errors[0].msg, 400, errorCode.invalid));
    }

    const { phone, password, token } = req.body;
    const user = await getUserByPhone(phone);

    checkUserExist(user);

    const otpRow = await getOtpByPhone(phone);
    checkOtpRow(otpRow);

    if (otpRow?.error === 5) {
      return next(
        createError(
          "Suspicious activity detected. Please contact support.",
          401,
          errorCode.attack
        )
      );
    }

    //if token not match,token not match is suspicious activity so we set error to 5
    if (otpRow?.verifyToken !== token) {
      const otpData = {
        error: 5,
      };
      await updateOtp(otpRow!.id, otpData);
      return next(createError("Invalid Token", 400, errorCode.invalid));
    }

    //request is expired after 10 minutes
    const isExpired = moment().diff(otpRow!.updatedAt, "minutes") > 10;

    if (isExpired) {
      return next(
        createError(
          "Request has expired. Please request a new one.",
          403,
          errorCode.requestExpired
        )
      );
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const randToken = "I will implement later";
    const userData = {
      phone,
      password: hashedPassword,
      randToken,
    };

    //create new user with dummy token and replace with real token after generating jwt tokens
    const newUser = await createUser(userData);

    const accessTokenPayload = {
      id: newUser.id,
    };

    const refreshTokenPayload = {
      id: newUser.id,
      count: newUser.phone,
    };

    const accessToken = jwt.sign(
      accessTokenPayload,
      process.env.ACCESS_TOKEN_SECRET!,
      { expiresIn: 60 * 15 }
    ); //15 minutes
    const refreshToken = jwt.sign(
      refreshTokenPayload,
      process.env.REFRESH_TOKEN_SECRET!,
      { expiresIn: 60 * 60 * 24 * 30 }
    ); //30 days

    const userUpdateData = {
      randToken: refreshToken,
    };

    await updateUser(newUser.id, userUpdateData);

    res
      .cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        maxAge: 10 * 60 * 1000, //10minutes
      })
      .cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000, //30days
      })
      .status(201)
      .json({
        message: "Successfully created new account",
        userid: newUser.id,
      });
  },
];

export const login = [
  body("phone", "Invalid Phone Number")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required")
    .matches("^[0-9]+$")
    .withMessage("Phone number must contain only digits")
    .isLength({ min: 5, max: 12 })
    .withMessage("Phone number must be between 5 and 12 digits"),
  body("password", "Password must contain only digits and be 8 digits long")
    .trim()
    .notEmpty()
    .matches("^[0-9]+$")
    .isLength({ min: 8, max: 8 }),
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req).array({ onlyFirstError: true });
    if (errors.length > 0) {
      return next(createError(errors[0].msg, 400, errorCode.invalid));
    }

    const password = req.body.password;
    let phone = req.body.phone;
    if (phone.slice(0, 2) === "09") {
      phone = phone.substring(2, phone.length);
    }

    const user = await getUserByPhone(phone);
    checkUserIfNotExist(user);

    if (user!.status === "FREEZE") {
      return next(
        createError(
          "Your account has been freezed. Please contact support.",
          403,
          errorCode.accountFreeze
        )
      );
    }

    const isMatchPassword = await bcrypt.compare(password, user!.password);

    if (!isMatchPassword) {
      const lastRequest = new Date(user!.updatedAt).toLocaleDateString();
      const isSameDay = lastRequest === new Date().toLocaleDateString();

      if (!isSameDay) {
        //new day reset error count
        const userData = {
          errorLoginCount: 1,
        };
        await updateUser(user!.id, userData);
      } else {
        //if error count reach 2 freeze account change status to FREEZE
        if (user!.errorLoginCount >= 2) {
          const userData = {
            status: "FREEZE",
          };
          await updateUser(user!.id, userData);
        } else {
          //error count not reach limit just increment error count
          const userData = {
            errorLoginCount: {
              increment: 1,
            },
          };
          await updateUser(user!.id, userData);
        }
      }
      return next(
        createError("Invalid Password", 401, errorCode.unauthenticated)
      );
    }

    //Authrization Token
    const accessTokenPayload = {
      id: user!.id,
    };

    const refreshTokenPayload = {
      id: user!.id,
      phone: user!.phone,
    };

    const accessToken = jwt.sign(
      accessTokenPayload,
      process.env.ACCESS_TOKEN_SECRET!,
      { expiresIn: 60 * 15 }
    ); //15 minutes
    const refreshToken = jwt.sign(
      refreshTokenPayload,
      process.env.REFRESH_TOKEN_SECRET!,
      { expiresIn: "30d" }
    ); //30 days

    const userData = {
      errorLoginCount: 0,
      randToken: refreshToken,
    };

    await updateUser(user!.id, userData);

    res
      .cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        maxAge: 15 * 60 * 1000, //15minutes
      })
      .cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000, //30days
      })
      .status(200)
      .json({ message: "Successfully Logged In", userid: user!.id });
  },
];

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const refreshToken = req.cookies ? req.cookies.refreshToken : null;

  if (!refreshToken) {
    return next(
      createError(
        "You are not an authenticated user",
        401,
        errorCode.unauthenticated
      )
    );
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET!) as {
      id: number;
      phone: string;
    };
  } catch (err) {
    return next(
      createError(
        "You are not an authenticated user",
        401,
        errorCode.unauthenticated
      )
    );
  }

  const user = await getUserById(decoded.id);
  checkUserIfNotExist(user);

  console.log(user!.phone, "this is decode", decoded.phone);

  if (user!.phone !== decoded.phone) {
    return next(
      createError(
        "You are not an authenticated user",
        401,
        errorCode.unauthenticated
      )
    );
  }

  const userData = {
    randToken: generateToken(),
  };

  await updateUser(user!.id, userData);

  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
  });
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
  });

  res.status(200).json({ message: "Successfully Logged Out!." });
};

export const forgetPassword = [
  body("phone", "Invalid Phone Number")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required")
    .matches("^[0-9]+$")
    .withMessage("Phone number must contain only digits")
    .isLength({ min: 5, max: 12 })
    .withMessage("Phone number must be between 5 and 12 digits"),
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req).array({ onlyFirstError: true });
    if (errors.length > 0) {
      return next(createError(errors[0].msg, 400, errorCode.invalid));
    }
    let phone = req.body.phone;
    if (phone.slice(0, 2) === "09") {
      phone = phone.substring(2, phone.length);
    }
    const user = await getUserByPhone(phone);
    checkUserIfNotExist(user);

    const otp = 123456; // TODO: Remove this line and uncomment the above line when in production
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otp.toString(), salt);
    const token = generateToken();

    const otpRow = await getOtpByPhone(phone);

    let result;

    const lastOtpRequest = new Date(otpRow!.updatedAt).toLocaleDateString();
    const today = new Date().toLocaleDateString();
    const isSameDay = lastOtpRequest === today;
    checkOtpErrorIfSameDate(isSameDay, otpRow!.error);

    if (!isSameDay) {
      const otpData = {
        otp: hashedOtp,
        rememberToken: token,
        count: 1,
        error: 0,
      };
      result = await updateOtp(otpRow!.id, otpData);
    } else {
      if (otpRow!.count === 5) {
        return next(
          createError(
            "You have reached the maximum number of OTP requests for today. Please try again tomorrow.",
            405,
            errorCode.overLimit
          )
        );
      } else {
        const otpData = {
          otp: hashedOtp,
          rememberToken: token,
          count: {
            increment: 1,
          },
        };
        result = await updateOtp(otpRow!.id, otpData);
      }
    }
    res.status(200).json({
      message: `OTP  successfully sent to 09${phone} for reset password!`,
      phone: result.phone,
      token: result.rememberToken,
    });
  },
];

export const verifyOtpPassword = [
  body("phone", "Invalid Phone Number")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required")
    .matches("^[0-9]+$")
    .withMessage("Phone number must contain only digits")
    .isLength({ min: 5, max: 12 })
    .withMessage("Phone number must be between 5 and 12 digits"),
  body("otp", "Invalid OTP")
    .trim()
    .notEmpty()
    .withMessage("OTP is required")
    .matches("^[0-9]+$")
    .isLength({ min: 6, max: 6 }),
  body("token", "Invalid Token")
    .trim()
    .notEmpty()
    .withMessage("OTP is required")
    .escape(),
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req).array({ onlyFirstError: true });
    if (errors.length > 0) {
      return next(createError(errors[0].msg, 400, errorCode.invalid));
    }

    const { phone, otp, token } = req.body;
    const user = await getUserByPhone(phone);
    checkUserIfNotExist(user);

    const otpRow = await getOtpByPhone(phone);

    // otp verify same date and over limit check
    const lastOtpVerify = new Date(otpRow!.updatedAt).toLocaleDateString();
    const today = new Date().toLocaleDateString();
    const isSameDay = lastOtpVerify === today;
    checkOtpErrorIfSameDate(isSameDay, otpRow!.error);

    let result;

    //if token not match
    if (otpRow?.rememberToken !== token) {
      const otpData = {
        error: 5,
      };
      await updateOtp(otpRow!.id, otpData);
      return next(createError("Invalid Token", 400, errorCode.invalid));
    }

    const isExpired = moment().diff(otpRow!.updatedAt, "minutes") > 2;

    if (isExpired) {
      return next(
        createError(
          "OTP has expired. Please request a new one.",
          403,
          errorCode.otpExpired
        )
      );
    }

    const isMatchOTP = await bcrypt.compare(otp, otpRow!.otp);

    if (!isMatchOTP) {
      //if  otp error is first time today
      if (!isSameDay) {
        const otpData = {
          error: 1,
        };
        await updateOtp(otpRow!.id, otpData);
      } else {
        //if otp error is not first time today
        const otpData = {
          error: {
            increment: 1,
          },
        };
        await updateOtp(otpRow!.id, otpData);
      }
      return next(createError("OTP is not correct!", 401, errorCode.invalid));
    }

    const verifyToken = generateToken();
    const optData = {
      verifyToken,
      error: 0,
      count: 1,
    };

    result = await updateOtp(otpRow!.id, optData);
    res.status(200).json({
      message: "OTP is Successfully Verifed for reset password!",
      phone: result.phone,
      token: result.verifyToken,
    });
  },
];

export const resetPassword = [
  body("phone", "Invalid Phone Number")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required")
    .matches("^[0-9]+$")
    .withMessage("Phone number must contain only digits")
    .isLength({ min: 5, max: 12 })
    .withMessage("Phone number must be between 5 and 12 digits"),
  body("password", "Password must contain only digits and be 8 digits long")
    .trim()
    .notEmpty()
    .matches("^[0-9]+$")
    .isLength({ min: 8, max: 8 }),
  body("token", "Invalid Token").trim().notEmpty().escape(),
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req).array({ onlyFirstError: true });
    if (errors.length > 0) {
      return next(createError(errors[0].msg, 400, errorCode.invalid));
    }

    const { phone, password, token } = req.body;
    const user = await getUserByPhone(phone);

    checkUserIfNotExist(user);

    const otpRow = await getOtpByPhone(phone);
    checkOtpRow(otpRow);

    if (otpRow?.error === 5) {
      return next(
        createError(
          "Suspicious activity detected. Please contact support.",
          401,
          errorCode.attack
        )
      );
    }

    //if token not match,token not match is suspicious activity so we set error to 5
    if (otpRow?.verifyToken !== token) {
      const otpData = {
        error: 5,
      };
      await updateOtp(otpRow!.id, otpData);
      return next(createError("Invalid Token", 400, errorCode.invalid));
    }

    //request is expired after 10 minutes
    const isExpired = moment().diff(otpRow!.updatedAt, "minutes") > 10;

    if (isExpired) {
      return next(
        createError(
          "Request has expired. Please request a new one.",
          403,
          errorCode.requestExpired
        )
      );
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const accessTokenPayload = {
      id: user!.id,
    };

    const refreshTokenPayload = {
      id: user!.id,
      count: user!.phone,
    };

    const accessToken = jwt.sign(
      accessTokenPayload,
      process.env.ACCESS_TOKEN_SECRET!,
      { expiresIn: 60 * 15 }
    ); //15 minutes
    const refreshToken = jwt.sign(
      refreshTokenPayload,
      process.env.REFRESH_TOKEN_SECRET!,
      { expiresIn: 60 * 60 * 24 * 30 }
    ); //30 days

    const userUpdateData = {
      password: hashedPassword,
      randToken: refreshToken,
    };

    await updateUser(user!.id, userUpdateData);

    res
      .cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        maxAge: 10 * 60 * 1000, //10minutes
      })
      .cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000, //30days
      })
      .status(201)
      .json({
        message: "Successfully reset password",
        userid: user!.id,
      });
  },
];
