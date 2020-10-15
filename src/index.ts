import {Request, Response} from "express";
import {Storage} from "@google-cloud/storage";

exports.jade = async (req: Request, res: Response) => {
    const storage = new Storage();
    const bucket = storage.bucket("jade-slack");
    const list = await bucket.getFiles({prefix: "image/"})
    console.log(JSON.stringify(list.length));
    res.status(200).sendFile("hi");
}
