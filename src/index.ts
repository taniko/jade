import {Request, Response} from "express";
import {Storage} from "@google-cloud/storage";
import {KeyManagementServiceClient} from "@google-cloud/kms";
import {WebClient} from "@slack/web-api";
import {createReadStream} from 'fs';
import * as crypto from 'crypto';
import timingSafeCompare from 'tsscmp';

exports.jade = async (req: Request, res: Response) => {
    const slack = new WebClient(await decrypt(process.env.SLACK_TOKEN as string));
    await slack.chat.postMessage({text: "hello", channel: req.body.channel_id})
    if (req.method !== 'POST') {
        await slack.chat.postMessage({text: "method", channel: req.body.channel_id})
        await slack.chat.postMessage({text: req.method, channel: req.body.channel_id})
        res.status(403).send("error");
        return;
    } else if (!await validation(req, slack)) {
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

const validation = async (req: Request, slack:  WebClient): Promise<boolean> => {
    await slack.chat.postMessage({text: req.headers["x-slack-request-timestamp"] as string, channel: req.body.channel_id})
    const timestamp = req.headers["x-slack-request-timestamp"] as string;
    if (Math.floor(new Date().getTime() / 1000) - parseInt(timestamp, 10) > 60 * 5) {
        return false;
    }
    const signature = req.headers["x-slack-signature"] as string;
    await slack.chat.postMessage({text: signature, channel: req.body.channel_id})
    const [version, hash] = signature.split('=');
    const secret = await decrypt(process.env.SIGNING_SECRET as string);
    if (secret === undefined) {
        await slack.chat.postMessage({text: "undefined", channel: req.body.channel_id})
        return false;
    } else {
        const hmac = crypto.createHmac('sha256', secret);
        await slack.chat.postMessage({text: "hmac", channel: req.body.channel_id})
        hmac.update(`${version}:${timestamp}:${JSON.stringify(req.body)}`);
        return timingSafeCompare(hash, hmac.digest('hex'));
    }
}
