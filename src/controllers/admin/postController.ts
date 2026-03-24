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
import sanitizeHtml from "sanitize-html";
import path from "path";
import { unlink } from "fs/promises";
import cacheQueue from "../../jobs/queues/cacheQueue";

interface customRequest extends Request {
  userId?: number;
  user?: any;
}

const removeFiles = async (
  originalFile: string,
  optimizedFile: string | null
) => {
  try {
    const originalFilePath = path.join(
      __dirname,
      "../../..",
      "/uploads/images",
      originalFile
    );

    await unlink(originalFilePath);
    if (optimizedFile) {
      const optimizedFilePath = path.join(
        __dirname,
        "../../..",
        "/uploads/optimize",
        optimizedFile
      );
      await unlink(optimizedFilePath);
    }
  } catch (err) {
    console.error("Error logging old profile image:", err);
  }
};

export const createPost = [
  body("title", "Title is required and must be a string")
    .trim()
    .notEmpty()
    .escape(),
  body("content", "Content is required and must be a string")
    .trim()
    .notEmpty()
    .escape(),
  body("body", "Body is required.")
    .trim()
    .notEmpty()
    .customSanitizer((value) => sanitizeHtml(value))
    .notEmpty(),
  body("category", "Category is required and must be a number")
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
      if (req.file) {
        await removeFiles(req.file.filename, null);
      }
      return next(createError(errors[0].msg, 400, errorCode.invalid));
    }

    const { title, content, body, category, type, tags } = req.body;

    const user = req.user;
    // const userId = req.userId;
    checkUploadFile(req.file);
    // const user = await getUserById(userId!);
    // if (!user) {
    //   if (req.file) {
    //     await removeFiles(req.file.filename, null);
    //   }
    //   return next(
    //     createError(
    //       "This phone number is not registered",
    //       401,
    //       errorCode.unauthenticated
    //     )
    //   );
    // }

    const splitFileName = req.file?.filename.split(".")[0];

    await ImageQueue.add(
      "optimize-image",
      {
        filePath: req.file?.path,
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

    const data: postArgs = {
      title,
      content,
      body,
      image: req.file!.filename,
      authorId: user!.id,
      category,
      type,
      tags,
    };

    const post = await createOnePost(data);

    await cacheQueue.add(
      "invalidate-post-cache",
      {
        pattern: "posts:*",
      },
      {
        jobId: `invalidate-${Date.now()}`,
        priority: 1,
      }
    );

    res
      .status(200)
      .json({ message: "Post created successfully", postId: post.id });
  },
];

export const updatePost = [
  body("postId", "postId is required and must be a string")
    .trim()
    .notEmpty()
    .isInt({ min: 1 }),
  body("title", "Title is required and must be a string")
    .trim()
    .notEmpty()
    .escape(),
  body("content", "Content is required and must be a string")
    .trim()
    .notEmpty()
    .escape(),
  body("body", "Body is required.")
    .trim()
    .notEmpty()
    .customSanitizer((value) => sanitizeHtml(value))
    .notEmpty(),
  body("category", "Category is required and must be a number")
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
      if (req.file) {
        await removeFiles(req.file.filename, null);
      }
      return next(createError(errors[0].msg, 400, errorCode.invalid));
    }

    const { postId, title, content, body, category, type, tags } = req.body;
    const userId = req.userId;

    // const user = await getUserById(userId!);
    // if (!user) {
    //   if (req.file) {
    //     await removeFiles(req.file.filename, null);
    //   }
    //   return next(
    //     createError(
    //       "This phone number is not registered",
    //       401,
    //       errorCode.unauthenticated
    //     )
    //   );
    // }
    const user = req.user;

    const post = await getPostById(+postId);
    if (!post) {
      if (req.file) {
        await removeFiles(req.file.filename, null);
      }
      return next(
        createError(
          "This post id is does not exist",
          401,
          errorCode.unauthenticated
        )
      );
    }

    if (user.id !== post.authorId) {
      if (req.file) {
        await removeFiles(req.file.filename, null);
      }
      return next(
        createError(
          "You are not authorise to update this post",
          403,
          errorCode.unauthorised
        )
      );
    }

    let data: any = {
      title,
      content,
      body,
      image: req.file,
      category,
      type,
      tags,
    };

    if (req.file) {
      data.image = req.file.filename;
      const splitFileName = req.file.filename.split(".")[0];

      await ImageQueue.add(
        "optimize-image",
        {
          filePath: req.file?.path,
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

      const optimizedFile = post.image.split(".")[0] + ".webp";
      await removeFiles(post.image, optimizedFile);
    }

    const postUpdated = await updateOnePost(post.id, data);
    await cacheQueue.add(
      "invalidate-post-cache",
      {
        pattern: "posts:*",
      },
      {
        jobId: `invalidate-${Date.now()}`,
        priority: 1,
      }
    );

    res
      .status(200)
      .json({ message: "Successfully Updated Post!", postId: postUpdated.id });
  },
];

export const deletePost = [
  body("postId", "postId is required and must be a string").isInt({ gt: 1 }),
  async (req: customRequest, res: Response, next: NextFunction) => {
    const errors = validationResult(req).array({ onlyFirstError: true });
    if (errors.length > 0) {
      return next(createError(errors[0].msg, 400, errorCode.invalid));
    }

    const { postId } = req.body;

    // const userId = req.userId;

    // const user = await getUserById(userId!);
    // checkUserIfNotExist(user);
    const user = req.user;
    const post = await getPostById(+postId);
    checkModelIfExist(post);

    if (user!.id !== post!.authorId) {
      return next(
        createError(
          "You are not authorise to update this post",
          403,
          errorCode.unauthorised
        )
      );
    }

    const postDeleted = await deleteOnePost(post!.id);
    const optimizedFile = post!.image.split(".")[0] + ".webp";
    await removeFiles(post!.image, optimizedFile);

    await cacheQueue.add(
      "invalidate-post-cache",
      {
        pattern: "posts:*",
      },
      {
        jobId: `invalidate-${Date.now()}`,
        priority: 1,
      }
    );

    res
      .status(200)
      .json({ message: "Post deleted successfully", postId: postDeleted.id });
  },
];
