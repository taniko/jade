import {Request, Response} from "express";
import {Storage} from "@google-cloud/storage";
import {KeyManagementServiceClient} from "@google-cloud/kms";
import {WebClient} from "@slack/web-api";

exports.jade = async (req: Request, res: Response) => {
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
        const slack: WebClient = new WebClient(await kms());
        console.log(req.body.toString())
        res.status(200).send();
    } else {
        res.status(500).send('error');
    }
    return;
}

const random = (max: number) => {
    return Math.floor(Math.random() * Math.floor(max));
}

const kms = async () => {
    const client = new KeyManagementServiceClient();
    const ciphertext = Buffer.from(process.env.SLACK_TOKEN as string, 'base64')
    const name = client.cryptoKeyPath(
        process.env.PROJECT as string,
        process.env.LOCATION as string,
        process.env.KEY_RING as string,
        process.env.KEY as string,
    )
    const [result] = await client.decrypt({name, ciphertext})
    return result.plaintext?.toString().trim()
}
