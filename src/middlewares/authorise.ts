import { Request, Response, NextFunction } from "express";
import { getUserById } from "../services/authService";
import { errorCode } from "../../config/errorCode";
import { createError } from "../utils/error";

interface customRequest extends Request {
  userId?: number;
  user ?: any;
}

// authorise(true, "admin","author")
// authorise(false, "user")
export const authorise = (permission: boolean, ...roles: string[]) => {
  return async (req: customRequest, res: Response, next: NextFunction) => {
    const userId = req.userId;
    const user = await getUserById(userId!);
    if (!user) {
      return next(
              createError("This account has not registered!.", 401, errorCode.unauthenticated)
            );
    }

    const result = roles.includes(user.role);
    if (permission && !result) {
      return next(
        createError("This action is forbidden!.", 403, errorCode.unauthorised)
      );
    }

    if (!permission && result) {
      return next(
        createError("This action is forbidden!.", 403, errorCode.unauthorised)
      );
    }

    req.user = user;
    next();
  };
};
