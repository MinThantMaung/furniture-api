import express, { NextFunction, Request, Response } from "express";

interface customRequest extends Request {
  user?: any;
}

export const getAllUsers = (
  req: customRequest,
  res: Response,
  next: NextFunction
) => {
  const user = req.user;
  res.status(200).json({ message: req.t("welcome"), currentUserRole: user.role });
};
