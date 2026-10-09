import QRCode from "qrcode";
import { parentPort } from "worker_threads";
import { searchUntilImproved } from "./radiation.js";

parentPort.on("message", message => {
    const { targetGray255, prefix, suffix, options } = message;
    parentPort.postMessage(searchUntilImproved({
        targetGray255,
        prefix,
        suffix,
        options,
        create: (text, options) => QRCode.create(text, options)
    }));
});
