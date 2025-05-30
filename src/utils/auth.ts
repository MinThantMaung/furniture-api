export const checkUserExist = (user: any) => {
  if (user) {
    const error: any = new Error("This phone is already registered!.");
    error.status = 409;
    error.code = "Error_AlreadyRegistered";
    throw error;
  }
};

export const checkOtpErrorIfSameDate = (
  isSameDate: boolean,
  errorCount: number
) => {
  if (isSameDate && errorCount === 5) {
    const error: any = new Error(
      "Otp is wrong for 5 times.Please try tomorrow!."
    );
    error.status = 401;
    error.code = "Error_LimitExceed!";
    throw error;
  }
};

export const checkOtpRow = (otpRow: any) => {
  if (!otpRow) {
    const error: any = new Error("Phone Number is incorrect.");
    error.status = 400;
    error.code = "Error_Invalid";
    throw error;
  }
};

// export const checkUserIfNotExist = (user: any) => {
//   if (!user) {
//     const error: any = new Error("This phone has not registered.");
//     error.status = 401;
//     error.code = errorCode.unauthenticated;
//     throw error;
//   }
// };
