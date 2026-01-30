import express, { NextFunction, Request, Response } from "express";
import { body, check, validationResult } from "express-validator";
import { createError } from "../../utils/error";
import { errorCode } from "../../../config/errorCode";
import { create } from "domain";
import { createOrUpdateSettingStatue } from "../../services/settingService";

interface customRequest extends Request {
  user?: any;
}

export const setMaintenance = [
  body("mode", "Mode must be boolean.")
    .isBoolean(),
  async (req: customRequest, res: Response, next: NextFunction) => {
    const errors = validationResult(req).array({ onlyFirstError: true });
    if (errors.length > 0) {
      return next(createError(errors[0].msg, 400, errorCode.invalid));
    }
    const { mode } = req.body;
    const value = mode ? "true" : "false";
    const message = mode ? "System is under maintenance mode." : "System is live now.";
    await createOrUpdateSettingStatue("maintenance", value);
    res.status(200).json({ message });
  },
];
