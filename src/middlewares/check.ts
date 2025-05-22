import { Request, Response, NextFunction } from "express";

interface customRequest extends Request {
  userId?: number;
}

export const check = (
  req: customRequest,
  res: Response,
  next: NextFunction
) => {
  req.userId = 12345;
  next();
};
