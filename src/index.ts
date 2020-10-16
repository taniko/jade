import {Request, Response} from "express";
import {Storage} from "@google-cloud/storage";
import {KeyManagementServiceClient} from "@google-cloud/kms";
import {WebClient} from "@slack/web-api";
import {createReadStream} from 'fs';
import * as crypto from 'crypto';

exports.jade = async (req: Request, res: Response) => {
    if (req.method !== 'POST') {
        res.status(403).send();
        return;
    } else if (! await validation(req)) {
        res.status(403).send();
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
    if (name != undefined) {
        const slack: WebClient = new WebClient(await decrypt(process.env.SLACK_TOKEN as string));
        // await slack.files.upload({channels: "", file: createReadStream(`/tmp/${name}`)});
        console.log(JSON.stringify(req.body()));
        res.status(200).send();
    } else {
        res.status(500).send('error');
    }
    return;
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
    const timestamp = req.headers["X-Slack-Request-Timestamp"] as string;
    if (Math.floor(new Date().getTime() / 1000) - parseInt(timestamp, 10) > 60 * 5) {
        return false;
    }
    const signature = req.headers["X-Slack-Signature"] as string;
    const hmac = crypto.createHmac("sha256", await decrypt(process.env.SIGNING_SECRET as string) as string);
    const body = req.body();
    const digest = hmac.update(`v0:${timestamp}:${body}`).digest('hex');
    return signature === `v0=${digest}`;
}
