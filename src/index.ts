import {Request, Response} from "express";

exports.jade = async (req: Request, res: Response) => {
    return res.status(200)
}
