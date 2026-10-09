import QRCode from "qrcode";
import { parentPort } from "worker_threads";
import { searchBudget, searchPosition } from "./radiation.js";

let state;

parentPort.on("message", message => {
    try {
        if (message.kind === "init") {
            state = {
                targetGray255: message.targetGray255,
                prefix: message.prefix,
                options: message.options
            };
            return;
        }
        if (!state) throw new Error("The worker was not initialized.");
        const common = {
            ...state,
            create: (text, options) => QRCode.create(text, options),
            suffix: message.suffix,
            bestLoss: message.bestLoss
        };
        const result = message.kind === "radiate"
            ? searchBudget({ ...common, budget: message.budget })
            : searchPosition({ ...common, index: message.index });
        parentPort.postMessage({ ...result, suffixGen: message.suffixGen });
    } catch (error) {
        parentPort.postMessage({ error: error.message, suffixGen: message.suffixGen });
    }
});
