import * as fs from "fs";
import QRCode from "qrcode";
import { PNG } from "pngjs";
import { Worker } from "worker_threads";
import { cpus } from "os";
import { loss, moduleCount } from "./radiation.js";

const numCPUs = cpus().length;

// Load target /////////////////////////////////////////////////////////////////
const config = JSON.parse(fs.readFileSync("./config.json"));
const target = PNG.sync.read(fs.readFileSync("target.png"));
const targetGray255 = target.data.filter((_, index) => index % 4 === 0);
const side = moduleCount(config.options.version);
if (target.width !== side || target.height !== side) {
    throw new Error(`target.png is ${target.width}×${target.height}. Version ${config.options.version} needs ${side}×${side}.`);
}
loss(targetGray255, QRCode.create(config.prefix + config.suffix, config.options).modules.data);
var bestSuffix = config.suffix;

// Delegate to workers, synchronize each progress //////////////////////////////
const workers = [];
function startWorkers() {
    for (let i = 0; i < numCPUs; i++) {
        const worker = new Worker(new URL("./worker.mjs", import.meta.url));
        worker.on("message", async message => {
            bestSuffix = message.suffix;
            console.log(message.loss, message.suffix);
            await QRCode.toFile("best.png", config.prefix + message.suffix, config.options);
            killWorkers(workers);
        });
        workers.push(worker);
        worker.postMessage({ targetGray255, prefix: config.prefix, suffix: bestSuffix, options: config.options });
    }
}

function killWorkers() {
    for (let worker of workers) {
        worker.terminate();
    }
    workers.length = 0;
    startWorkers();
}

startWorkers();
