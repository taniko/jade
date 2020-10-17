import {Request, Response} from "express";
import {Storage} from "@google-cloud/storage";
import {KeyManagementServiceClient} from "@google-cloud/kms";
import {WebClient} from "@slack/web-api";
import {createReadStream} from 'fs';
import * as crypto from 'crypto';
import qs from 'qs'

exports.jade = async (req: Request, res: Response) => {
    if (req.method !== 'POST') {
        res.status(403).send("error");
        return;
    } else if (!await validation(req)) {
        res.status(403).send("error");
        return;
    }
    const storage = new Storage();
    const bucket = storage.bucket("jade-slack");
    const [files] = await bucket.getFiles({
        directory: "image",
    });
    const reg = /\./
    const candidate = files.filter(v => {
        return reg.test(v.name)
    });
    const file = candidate[random(candidate.length)];
    const name = file.name.split('/').pop()
    await candidate[random(candidate.length)].download({destination: `/tmp/${name}`});
    const slack = new WebClient(await decrypt(process.env.SLACK_TOKEN as string));
    await slack.files.upload({channels: req.body.channel_id, file: createReadStream(`/tmp/${name}`)});
    res.status(200).send("ok");
}

const random = (max: number) => {
    return Math.floor(Math.random() * Math.floor(max));
}

const decrypt = async (enc: string) => {
    const client = new KeyManagementServiceClient();
    const ciphertext = Buffer.from(enc, 'base64')
    const name = client.cryptoKeyPath(
        process.env.PROJECT as string,
        process.env.LOCATION as string,
        process.env.KEY_RING as string,
        process.env.KEY as string,
    )
    const [result] = await client.decrypt({name, ciphertext})
    return result.plaintext?.toString().trim()
}

const validation = async (req: Request): Promise<boolean> => {
    const timestamp = req.headers["x-slack-request-timestamp"] as string;
    if (Math.floor(new Date().getTime() / 1000) - parseInt(timestamp, 10) > 60 * 5) {
        return false;
    }
    const signature = req.headers["x-slack-signature"] as string;
    const secret = await decrypt(process.env.SIGNING_SECRET as string);
    const hmac = crypto.createHmac('sha256', secret as string);
    hmac.update(`v0:${timestamp}:${qs.stringify(req.body, {format: 'RFC1738'})}`);
    return signature === `v0=${hmac.digest('hex')}`;
}
