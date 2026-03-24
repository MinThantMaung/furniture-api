import { NextFunction, Request, Response } from "express";
import { body, check, param, query, validationResult } from "express-validator";
import { errorCode } from "../../../config/errorCode";
import { checkUserIfNotExist } from "../../utils/auth";
import { checkModelIfExist, checkUploadFile } from "../../utils/check";
import { createError } from "../../utils/error";
import { getUserById } from "../../services/authService";
import { getOrSetCache } from "../../utils/cache";
import { getProductsList, getProductsWithRelations } from "../../services/productService";
import path from "node:path";

interface customRequest extends Request {
  userId?: number;
}

export const getProduct = [
  param("id", "Product Id is required and must be a number").isInt({ gt: 0 }),
  async (req: customRequest, res: Response, next: NextFunction) => {
    const errors = validationResult(req).array({ onlyFirstError: true });
    if (errors.length > 0) {
      return next(createError(errors[0].msg, 400, errorCode.invalid));
    }

    const productId = req.params.id;
    const userId = req.userId;
    const user = await getUserById(userId!);
    checkUserIfNotExist(user!);

    //const post = await getPostsWithRelations(+postId);
    const cacheKey = `products:${JSON.stringify(productId)}`;
    const product = await getOrSetCache(cacheKey, async () => {
      return await getProductsWithRelations(+productId);
    });

    checkModelIfExist(product);
    res
      .status(200)
      .json({ message: "Product retrieved successfully", product });
  },
];

export const getProductsByPagination = [
  query("cursor", "Cursor must be product ID.").isInt({ gt: 0 }).optional(),
  query("limit", "Limit must be a positive integer.")
    .isInt({ gt: 4 })
    .optional(),
  async (req: customRequest, res: Response, next: NextFunction) => {
    const errors = validationResult(req).array({ onlyFirstError: true });
    if (errors.length > 0) {
      return next(createError(errors[0].msg, 400, errorCode.invalid));
    }

    const lastCursor = req.query.cursor;
    const limit = req.query.limit || 5;
    const category = req.query.category;
    const type = req.query.type;

    const userId = req.userId;
    const user = await getUserById(userId!);
    checkUserIfNotExist(user!);

    let categoryList: number[] = [];
    let typeList: number[] = [];

    if (category) {
      categoryList = category
        .toString()
        .split(",")
        .map((c) => Number(c))
        .filter((c) => c > 0);
    }

    if (type) {
      typeList = type
        .toString()
        .split(",")
        .map((t) => Number(t))
        .filter((t) => t > 0);
    }

    const where = {
      AND: [
        categoryList.length > 0 ? { categoryId: { in: categoryList } } : {},
        typeList.length > 0 ? { typeId: { in: typeList } } : {},
      ],
    };

    const options = {
      where,
      take: +limit + 1, // Fetch one extra record to check if there are more records available
      skip: lastCursor ? 1 : 0, // Skip the last record if cursor is provided
      cursor: lastCursor ? { id: +lastCursor } : undefined,
      select: {
        id: true,
        name: true,
        price: true,
        discount: true,
        status: true,
        images: {
          select:{
            id: true,
            path: true,
          },
          take: 1, // Fetch only the first image for each product
        }
      },
      orderBy: {
        id: "desc",
      },
    };

    const cacheKey = `products:${JSON.stringify(req.query)}`;
    const products = await getOrSetCache(cacheKey, async () => {
      return await getProductsList(options);
    });

    const hasNextPage = products.length > +limit;

    if (hasNextPage) {
      products.pop(); // Remove the extra record if it exists
    }

    const newCursor = products.length > 0 ? products[products.length - 1].id : null;

    res.status(200).json({
      message: "Get All product with cursor",
      products,
      newCursor,
      hasNextPage,
    });
  },
];
