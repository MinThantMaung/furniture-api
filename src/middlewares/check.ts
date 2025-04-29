import {Request, Response, NextFunction} from 'express';

interface customRequest extends Request{
    userId ?: number;
}

export const check = (req: customRequest, res: Response, next: NextFunction) => {
    // const err:any = new Error("Token has expired.");
    // err.status = 401;
    // err.code = "Error_TokenExpired.";
    // return next(err);
    req.userId = 12345;
    next();
}