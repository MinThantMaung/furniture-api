import { errorCode } from "../../config/errorCode";

export const checkUserExist = (user: any) => {
  if (user) {
    const error: any = new Error("Phone number is already registered");
    error.status = 409;
    error.code = errorCode.userExist;
    throw error;
  }
};

export const checkOtpErrorIfSameDate = (
  isSameDate: boolean,
  errorCount: number
) => {
  if (isSameDate && errorCount === 5) {
    const error: any = new Error(
      "You have reached the maximum number of OTP requests for today. Please try again tomorrow."
    );
    error.status = 401;
    error.code = errorCode.overLimit;
    throw error;
  }
};

export const checkOtpRow = (otpRow: any) => {
  if (!otpRow) {
    const error: any = new Error("Invalid OTP or Phone number");
    error.status = 400;
    error.code = errorCode.invalid;
    throw error;
  }
};

export const checkUserIfNotExist = (user: any) => {
  if (!user) {
    const error: any = new Error("This phone number is not registered");
    error.status = 401;
    error.code = errorCode.unauthenticated;
    throw error;
  }
};
