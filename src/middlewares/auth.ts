import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { errorCode } from "../../config/errorCode";
import { getUserById, updateUser } from "../services/authService";
import { ref } from "process";
import { createError } from "../utils/error";

interface customRequest extends Request {
  userId?: number;
}

export const auth = (req: customRequest, res: Response, next: NextFunction) => {
  //request from mobile app
  const platform = req.headers["x-platform"];
  // if (platform === "mobile") {
  //   const accessTokenMobile = req.headers.authorization?.split(" ")[1];
  //   console.log("Mobile Access Token:", accessTokenMobile);
  // }else {
  //   console.log("Web Platform Access");
  // }
  const accessToken = req.cookies ? req.cookies.accessToken : null;
  const refreshToken = req.cookies ? req.cookies.refreshToken : null;

  if (!refreshToken) {
    return next(
      createError(
        "Unauthorized Access - No Token",
        401,
        errorCode.unauthenticated
      )
    );
  }

  const generateNewTokens = async () => {
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET!) as {
        id: number;
        phone: String;
      };
    } catch (e: any) {
      return next(
        createError(
          "You are not authorized user!",
          401,
          errorCode.accessTokenExpired
        )
      );
    }

    if (isNaN(decoded.id)) {
      return next(
        createError(
          "You are not authorized user!",
          401,
          errorCode.unauthenticated
        )
      );
    }

    const user = await getUserById(decoded.id);
    if (!user) {
      return next(
        createError("Account does not exist", 404, errorCode.unauthenticated)
      );
    }

    if (user.phone !== decoded.phone) {
      return next(
        createError("Account does not exist", 401, errorCode.unauthenticated)
      );
    }

    if (user.randToken !== refreshToken) {
      return next(
        createError(
          "You are not authorized user!",
          401,
          errorCode.unauthenticated
        )
      );
    }

    //Authrization Token
    const accessTokenPayload = {
      id: user.id,
    };

    const refreshTokenPayload = {
      id: user.id,
      phone: user.phone,
    };

    const newAccessToken = jwt.sign(
      accessTokenPayload,
      process.env.ACCESS_TOKEN_SECRET!,
      { expiresIn: 60 * 15 }
    ); //15 minutes
    const newRefreshToken = jwt.sign(
      refreshTokenPayload,
      process.env.REFRESH_TOKEN_SECRET!,
      { expiresIn: "30d" }
    ); //30 days

    const userData = {
      errorLoginCount: 0,
      randToken: newRefreshToken,
    };

    await updateUser(user!.id, userData);

    res
      .cookie("accessToken", newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        maxAge: 15 * 60 * 1000, //15minutes
      })
      .cookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000, //30days
      });

    req.userId = user.id;
    next();
  };

  if (!accessToken) {
    generateNewTokens();
  } else {
    //Verify access token
    let decoded;
    try {
      decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET!) as {
        id: number;
      };
      if (isNaN(decoded.id)) {
        return next(
          createError(
            "You are not authorized user!",
            401,
            errorCode.unauthenticated
          )
        );
      }
      req.userId = decoded.id;

      next();
    } catch (error: any) {
      if (error.name === "TokenExpiredError") {
        generateNewTokens();
        // error.message = "Access Token Expired";
        // error.status = 401;
        // error.code = errorCode.accessTokenExpired;
      } else {
        return next(
          createError("Invalid Access Token", 400, errorCode.attack)
        );
      }
    }
  }
};
