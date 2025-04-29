import express, {NextFunction, Request, Response} from "express";

interface customRequest extends Request{
    userId ?: number;
}

export const healthCheck= (req:customRequest, res:Response,next:NextFunction) => {
    res.status(200).json({message: "Hello",userId: req.userId });
}