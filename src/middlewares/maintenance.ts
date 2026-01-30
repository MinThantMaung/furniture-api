import { Request, Response, NextFunction } from "express";
import { getSettingStatue } from "../services/settingService";
import { errorCode } from "../../config/errorCode";
import { createError } from "../utils/error";

const whitelist = ["127.0.0.1"];
export const maintenance = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const ip: any = req.header("x-forwarded-for") || req.socket.remoteAddress;
  if (whitelist.includes(ip)) {
    console.log(`allowed ip: ${ip}`);
    return next();
  } else {
    console.log(`disallowed ip: ${ip}`);
    const setting = await getSettingStatue("maintenance");
    if (setting?.value === "true") {
      return next(
        createError(
          "Service currently under maintenance",
          503,
          errorCode.maintenance
        )
      );
    }
    next();
  }
};
