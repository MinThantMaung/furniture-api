import { NextFunction, Request, Response } from "express";
import { body, check, query, validationResult } from "express-validator";
import { errorCode } from "../../../config/errorCode";
import { checkUserIfNotExist } from "../../utils/auth";
import { checkModelIfExist, checkUploadFile } from "../../utils/check";
import { createError } from "../../utils/error";
import { getUserById } from "../../services/authService";
import ImageQueue from "../../jobs/queues/imageQueue";
import {
  createOnePost,
  deleteOnePost,
  getPostById,
  postArgs,
  updateOnePost,
} from "../../services/postService";
import path from "path";
import { unlink } from "fs/promises";
import cacheQueue from "../../jobs/queues/cacheQueue";
import {
  createOneProduct,
  deleteOneProduct,
  getProductById,
  updateOneProduct,
} from "../../services/productService";

interface customRequest extends Request {
  userId?: number;
  user?: any;
  files?: any;
}

const removeFiles = async (
  originalFiles: string[],
  optimizedFiles: string[] | null
) => {
  try {
    for (const originalFile of originalFiles) {
      const originalFilePath = path.join(
        __dirname,
        "../../..",
        "/uploads/images",
        originalFile
      );
      await unlink(originalFilePath);
    }

    if (optimizedFiles) {
      for (const optimizedFile of optimizedFiles) {
        const optimizedFilePath = path.join(
          __dirname,
          "../../..",
          "/uploads/optimize",
          optimizedFile
        );
        await unlink(optimizedFilePath);
      }
    }
  } catch (err) {
    console.error("Error logging old profile image:", err);
  }
};

export const createProduct = [
  body("name", "Name is required and must be a string")
    .trim()
    .notEmpty()
    .escape(),
  body("description", "Description is required and must be a string")
    .trim()
    .notEmpty()
    .escape(),
  body("price", "Price is required and must be a number")
    .isFloat({ min: 0.1 })
    .isDecimal({ decimal_digits: "1,2" }),
  body("discount", "Discount is required and must be a number")
    .isFloat({ min: 0 })
    .isDecimal({ decimal_digits: "1,2" }),
  body("inventory", "Inventory is required and must be a number").isInt({
    min: 1,
  }),
  body("category", "Category is required and must be a string")
    .trim()
    .notEmpty()
    .escape(),
  body("type", "Type is required and must be a number")
    .trim()
    .notEmpty()
    .escape(),
  body("tags", "Tags is invalid.")
    .optional({ nullable: true })
    .customSanitizer((value) => {
      if (!value) {
        return value.split(",").filter((tag: string) => tag.trim() !== "");
      }
      return value;
    }),
  async (req: customRequest, res: Response, next: NextFunction) => {
    const errors = validationResult(req).array({ onlyFirstError: true });
    if (errors.length > 0) {
      if (req.files && req.files.length > 0) {
        const originalFiles = req.files.map((file: any) => file.filename);
        await removeFiles(originalFiles, null);
      }
      return next(createError(errors[0].msg, 400, errorCode.invalid));
    }

    const {
      name,
      description,
      price,
      discount,
      inventory,
      category,
      type,
      tags,
    } = req.body;

    const user = req.user;
    checkUploadFile(req.files && req.files.length > 0);

    const files = req.files || [];

    await Promise.all(
      files.map(async (file: any) => {
        const splitFileName = file.filename.split(".")[0];

        return ImageQueue.add(
          "optimize-image",
          {
            filePath: file.path,
            fileName: `${splitFileName}.webp`,
            width: 835,
            height: 577,
            quality: 100,
          },
          {
            attempts: 3,
            backoff: {
              type: "exponential",
              delay: 1000,
            },
          }
        );
      })
    );

    const originalFileNames = req.files.map((file: any) => ({
      path: file.filename,
    }));

    const data: any = {
      name,
      description,
      price,
      discount,
      inventory: +inventory,
      category,
      type,
      tags,
      images: originalFileNames,
    };

    const product = await createOneProduct(data);

    await cacheQueue.add(
      "invalidate-product-cache",
      {
        pattern: "products:*",
      },
      {
        jobId: `invalidate-${Date.now()}`,
        priority: 1,
      }
    );

    res
      .status(201)
      .json({ message: "Product created successfully", productId: product.id });
  },
];

export const updateProduct = [
  body("productId", "Product ID is required and must be a number").isInt({
    min: 1,
  }),
  body("name", "Name is required and must be a string")
    .trim()
    .notEmpty()
    .escape(),
  body("description", "Description is required and must be a string")
    .trim()
    .notEmpty()
    .escape(),
  body("price", "Price is required and must be a number")
    .isFloat({ min: 0.1 })
    .isDecimal({ decimal_digits: "1,2" }),
  body("discount", "Discount is required and must be a number")
    .isFloat({ min: 0 })
    .isDecimal({ decimal_digits: "1,2" }),
  body("inventory", "Inventory is required and must be a number").isInt({
    min: 1,
  }),
  body("category", "Category is required and must be a string")
    .trim()
    .notEmpty()
    .escape(),
  body("type", "Type is required and must be a number")
    .trim()
    .notEmpty()
    .escape(),
  body("tags", "Tags is invalid.")
    .optional({ nullable: true })
    .customSanitizer((value) => {
      if (!value) {
        return value.split(",").filter((tag: string) => tag.trim() !== "");
      }
      return value;
    }),
  async (req: customRequest, res: Response, next: NextFunction) => {
    const errors = validationResult(req).array({ onlyFirstError: true });
    if (errors.length > 0) {
      if (req.files && req.files.length > 0) {
        const originalFiles = req.files.map((file: any) => file.filename);
        await removeFiles(originalFiles, null);
      }
      return next(createError(errors[0].msg, 400, errorCode.invalid));
    }

    const {
      productId,
      name,
      description,
      price,
      discount,
      inventory,
      category,
      type,
      tags,
    } = req.body;

    const product = await getProductById(+productId);

    if (!product) {
      if (req.files && req.files.length > 0) {
        const originalFiles = req.files.map((file: any) => file.filename);
        await removeFiles(originalFiles, null);
      }

      return next(createError("Product not found", 409, errorCode.invalid));
    }

    let originalFileNames = [];
    if (req.files && req.files.length > 0) {
      originalFileNames = req.files.map((file: any) => ({
        path: file.filename,
      }));
    }

    const data: any = {
      name,
      description,
      price,
      discount,
      inventory: +inventory,
      category,
      type,
      tags,
      images: originalFileNames,
    };

    if (req.files && req.files.length > 0) {
      await Promise.all(
        req.files.map(async (file: any) => {
          const splitFileName = file.filename.split(".")[0];

          return ImageQueue.add(
            "optimize-image",
            {
              filePath: file.path,
              fileName: `${splitFileName}.webp`,
              width: 835,
              height: 577,
              quality: 100,
            },
            {
              attempts: 3,
              backoff: {
                type: "exponential",
                delay: 1000,
              },
            }
          );
        })
      );
    }

    const orgFiles = product.images.map((image: any) => image.path);
    const optFiles = product.images.map(
      (image: any) => image.path.split(".")[0] + ".webp"
    );
    await removeFiles(orgFiles, optFiles);

    const productUpdated = await updateOneProduct(+productId, data);

    await cacheQueue.add(
      "invalidate-product-cache",
      {
        pattern: "products:*",
      },
      {
        jobId: `invalidate-${Date.now()}`,
        priority: 1,
      }
    );

    res
      .status(200)
      .json({
        message: "Product updated successfully",
        product: productUpdated,
      });
  },
];

export const deleteProduct = [
  body("productId", "Product ID is required and must be a number").isInt({
    min: 1,
  }),
  async (req: customRequest, res: Response, next: NextFunction) => {
    const errors = validationResult(req).array({ onlyFirstError: true });
    if (errors.length > 0) {
      return next(createError(errors[0].msg, 400, errorCode.invalid));
    }

    const { productId } = req.body;

    const product = await getProductById(+productId);
    checkModelIfExist(product);

    const productDeleted = await deleteOneProduct(+product!.id);

    const orgFiles = product!.images.map((image: any) => image.path);
    const optFiles = product!.images.map(
      (image: any) => image.path.split(".")[0] + ".webp"
    );
    await removeFiles(orgFiles, optFiles);

    await cacheQueue.add(
      "invalidate-product-cache",
      {
        pattern: "products:*",
      },
      {
        jobId: `invalidate-${Date.now()}`,
        priority: 1,
      }
    );

    res
      .status(200)
      .json({
        message: "Product deleted successfully",
        product: productDeleted,
      });
  },
];
