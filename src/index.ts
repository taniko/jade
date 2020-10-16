import {Request, Response} from "express";
import {Storage} from "@google-cloud/storage";
import {KeyManagementServiceClient} from "@google-cloud/kms";
import {WebClient} from "@slack/web-api";
import {createReadStream} from 'fs';
import * as crypto from 'crypto';
import qs from "qs";

exports.jade = async (req: Request, res: Response) => {
    const slack: WebClient = new WebClient(await decrypt(process.env.SLACK_TOKEN as string));
    await slack.chat.postMessage({text: "hello", channel: req.body.channel_id})
    if (req.method !== 'POST') {
        await slack.chat.postMessage({text: "method", channel: req.body.channel_id})
        await slack.chat.postMessage({text: req.method, channel: req.body.channel_id})
        res.status(403).send("error");
        return;
    } else if (!await validation(req)) {
        await slack.chat.postMessage({text: "failed validation", channel: req.body.channel_id})
        res.status(403).send("error");
        return;
    }
    await slack.chat.postMessage({text: "pass", channel: req.body.channel_id})
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
        // await slack.files.upload({channels: "", file: createReadStream(`/tmp/${name}`)});
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
    const body = qs.stringify(req.body, {format: 'RFC1738'});
    const digest = hmac.update(`v0:${timestamp}:${body}`, 'utf8').digest('hex');
    return signature === `v0=${digest}`;
}
