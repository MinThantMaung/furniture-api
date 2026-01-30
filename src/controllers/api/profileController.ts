import express, { NextFunction, Request, Response } from "express";
import { body, check, query, validationResult } from "express-validator";
import { errorCode } from "../../../config/errorCode";
import { createError } from "../../utils/error";
import { get } from "http";
import { getUserById, updateUser } from "../../services/authService";
import { checkUserIfNotExist } from "../../utils/auth";
import { checkUploadFile } from "../../utils/check";
import { unlink } from "node:fs/promises";
import path from "path";
import sharp from "sharp";

interface customRequest extends Request {
  userId?: number;
  file?: any;
}

export const changeLanguage = [
  query("lng", "Invalid Language Code")
    .trim()
    .notEmpty()
    .matches("^[a-z]+$")
    .isLength({ min: 2, max: 3 }),
  (req: customRequest, res: Response, next: NextFunction) => {
    const errors = validationResult(req).array({ onlyFirstError: true });
    if (errors.length > 0) {
      return next(createError(errors[0].msg, 400, errorCode.invalid));
    }

    const { lng } = req.query;
    res.cookie("i18next", lng);
    res.status(200).json({ message: req.t("changeLanguage", { lang: lng }) });
  },
];

export const uploadProfile = async (
  req: customRequest,
  res: Response,
  next: NextFunction
) => {
  const userId = req.userId;
  const image = req.file;

  const user = await getUserById(userId!);
  checkUserIfNotExist(user);
  checkUploadFile(image);

  const fileName = image!.filename;
  // const filePath = image?.path;
  // const filePath = image?.path.replace("\\","/"); // For Windows compatibility

  if (user?.image) {
    const filePath = path.join(
      __dirname,
      "../../..",
      "/uploads/images",
      user?.image!
    );
    try {
      await unlink(filePath);
    } catch (err) {
      console.error("Error logging old profile image:", err);
    }
  }

  const userDate = {
    image: fileName,
  };

  await updateUser(user?.id!, userDate);

  res
    .status(200)
    .json({ message: "Profile image uploaded successfully", image: fileName });
};

export const getProfileTest = async (
  req: customRequest,
  res: Response,
  next: NextFunction
) => {
  const file = path.join(
    __dirname,
    "../../..",
    "/uploads/images",
    "1769525916186-934622296-Gemini_Generated_Image_9f93lk9f93lk9f93.png" //user?.image!
  );
  res.sendFile(file, (err) => {
    res.status(404).send({ message: "File Not Found" });
  });
};

export const uploadProfileMultiple = async (
  req: customRequest,
  res: Response,
  next: NextFunction
) => {
  //challange upload multiple files same with upload just add for each loop
  res
    .status(200)
    .json({ message: "Multiple profile image uploaded successfully" });
};

export const uploadProfileOptimize = async (
  req: customRequest,
  res: Response,
  next: NextFunction
) => {
  const userId = req.userId;
  const image = req.file;

  const user = await getUserById(userId!);
  checkUserIfNotExist(user);
  checkUploadFile(image);

  const fileName = Date.now() + "-" + `${Math.round(Math.random() * 1e9)}.webp`;

  try {
    const optimizedImagePath = path.join(
      __dirname,
      "../../../",
      "uploads/images",
      fileName
    );
    await sharp(req.file?.buffer)
      .resize(200, 200)
      .webp({ quality: 50 })
      .toFile(optimizedImagePath);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Image optimization failed" });
    return;
  }
  if (user?.image) {
    const filePath = path.join(
      __dirname,
      "../../..",
      "/uploads/images",
      user?.image!
    );
    try {
      await unlink(filePath);
    } catch (err) {
      console.error("Error logging old profile image:", err);
    }
  }

  const userDate = {
    image: fileName,
  };

  await updateUser(user?.id!, userDate);

  res
    .status(200)
    .json({ message: "Profile image uploaded successfully", image: fileName });
};
