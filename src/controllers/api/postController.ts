import { NextFunction, Request, Response } from "express";
import { body, check, param, query, validationResult } from "express-validator";
import { errorCode } from "../../../config/errorCode";
import { checkUserIfNotExist } from "../../utils/auth";
import { checkModelIfExist, checkUploadFile } from "../../utils/check";
import { createError } from "../../utils/error";
import { getUserById } from "../../services/authService";
import { getPostById, getPostsList, getPostsWithRelations } from "../../services/postService";
import { auth } from "../../middlewares/auth";
import { getOrSetCache } from "../../utils/cache";

interface customRequest extends Request {
  userId?: number;
}

export const getPost = [
  param("id", "Post Id is required and must be a number").isInt({gt: 0}),
  async (req: customRequest, res: Response, next: NextFunction) => {
    const errors = validationResult(req).array({ onlyFirstError: true });
    if (errors.length > 0) {
      return next(createError(errors[0].msg, 400, errorCode.invalid));
    }

    const postId = req.params.id;
    const userId = req.userId;
    const user = await getUserById(userId!);
    checkUserIfNotExist(user!);

    //const post = await getPostsWithRelations(+postId);
    const cacheKey = `posts:${JSON.stringify(postId)}`;
    const post = await getOrSetCache(cacheKey, async () => {
      return await getPostsWithRelations(+postId);
    });

    checkModelIfExist(post);
    // const modifiedPost = {
    //   id: post?.id,
    //   title: post?.title,
    //   content: post?.content,
    //   body: post?.body,
    //   image: "/optimize/" + post?.image.split(".")[0] + ".webp",
    //   updatedAt: post?.updatedAt.toLocaleDateString("en-US", {
    //     year: "numeric",
    //     month: "long",
    //     day: "numeric",
    //   }),
    //   fullname: (post?.author.firstName ?? "")+ " " + (post?.author.lastName ?? ""),
    //   category: post?.category.name,
    //   type: post?.type.name,
    //   tags: post?.tags && post?.tags.length > 0 ? post?.tags.map((tag) => tag.name) : null,
    // };
    res.status(200).json({ message: "Post retrieved successfully", post });
  },
];

export const getPostsByPagination = [
  query("page", "Page number must be a positive integer.").isInt({ gt: 0 }).optional(),
  query("limit", "Limit must be a positive integer.").isInt({ gt: 4 }).optional(),
  async (req: customRequest, res: Response, next: NextFunction) => {
    const errors = validationResult(req).array({ onlyFirstError: true });
    if (errors.length > 0) {
      return next(createError(errors[0].msg, 400, errorCode.invalid));
    }

    const page = req.query.page || 1;
    const limit = req.query.limit || 5;

    const userId = req.userId;
    const user = await getUserById(userId!);
    checkUserIfNotExist(user!);

    const skip = (+page - 1) * +limit;
    const options = {
      skip,
      take: +limit + 1, // Fetch one extra record to check if there are more records available
      select: {
        id: true,
        title: true,
        content: true,
        image: true,
        updatedAt: true,
        author: {
          select: {
            fullName: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    }
    //const posts = await getPostsList(options);

    const cacheKey = `posts:${JSON.stringify(req.query)}`;
    const posts = await getOrSetCache(cacheKey, async () => {
      return await getPostsList(options);
    });

    const hasNextPage = posts.length > +limit;

    let nextPage = null;

    const previousPage = +page !== 1 ? +page - 1 : null;

    if(hasNextPage) {
      posts.pop(); // Remove the extra record if it exists
      nextPage = +page + 1;
    }

    res.status(200).json({ message: "Get posts with offset pagination", currentPage: page, hasNextPage, nextPage, previousPage, posts });
  },
];


export const getInfinitePostsByPagination = [
  query("cursor", "Cursor must be post ID.").isInt({ gt: 0 }).optional(),
  query("limit", "Limit must be a positive integer.").isInt({ gt: 4 }).optional(),
  async (req: customRequest, res: Response, next: NextFunction) => {
    const errors = validationResult(req).array({ onlyFirstError: true });
    if (errors.length > 0) {
      return next(createError(errors[0].msg, 400, errorCode.invalid));
    }

    const lastCursor = req.query.cursor;
    const limit = req.query.limit || 5;

    const userId = req.userId;
    const user = await getUserById(userId!);
    checkUserIfNotExist(user!);

    const options = {
      take: +limit + 1, // Fetch one extra record to check if there are more records available
      skip: lastCursor ? 1 : 0, // Skip the last record if cursor is provided
      cursor: lastCursor ? { id: +lastCursor } : undefined,
      select: {
        id: true,
        title: true,
        content: true,
        image: true,
        updatedAt: true,
        author: {
          select: {
            fullName: true,
          },
        },
      },
      orderBy: {
        id: "asc"
      },
    }



    //const posts = await getPostsList(options);
    const cacheKey = `posts:${JSON.stringify(req.query)}`;
    const posts = await getOrSetCache(cacheKey, async () => {
      return await getPostsList(options);
    });

    const hasNextPage = posts.length > +limit;

    if(hasNextPage) {
      posts.pop(); // Remove the extra record if it exists
    }

    const newCursor = posts.length > 0 ? posts[posts.length - 1].id : null;

    res.status(200).json({ message: "Get All post with cursor", posts , newCursor, hasNextPage });
  },
];