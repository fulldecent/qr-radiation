import * as fs from "fs";
import QRCode from "qrcode";
import { PNG } from "pngjs";
import { Worker } from "worker_threads";
import { cpus } from "os";
import { loss, moduleCount, moveKinds } from "./radiation.js";

const numCPUs = cpus().length;
const moveBudget = 8;

const config = JSON.parse(fs.readFileSync("./config.json"));
const target = PNG.sync.read(fs.readFileSync("target.png"));
const targetGray255 = target.data.filter((_, index) => index % 4 === 0);
const side = moduleCount(config.options.version);
if (target.width !== side || target.height !== side) {
    throw new Error(`target.png is ${target.width}×${target.height}. Version ${config.options.version} needs ${side}×${side}.`);
}

let bestSuffix = config.suffix;
let bestLoss = loss(targetGray255, QRCode.create(config.prefix + bestSuffix, config.options).modules.data);
let suffixGen = 1;
let nextIndex = 0;
let saveChain = Promise.resolve();

function remember(suffix) {
    const text = config.prefix + suffix;
    const generation = suffixGen;
    saveChain = saveChain.then(async () => {
        if (generation !== suffixGen) return;
        await QRCode.toFile("best.png", text, config.options);
    }).catch(error => {
        console.error(error.message);
    });
}

const workers = [];
for (let i = 0; i < numCPUs; i++) {
    const worker = new Worker(new URL("./worker.mjs", import.meta.url));
    worker.on("message", message => onWorker(worker, message));
    worker.postMessage({
        kind: "init",
        targetGray255,
        prefix: config.prefix,
        options: config.options
    });
    workers.push(worker);
    assign(worker);
}

function assign(worker) {
    const move = moveKinds[nextIndex % moveKinds.length];
    nextIndex++;
    worker.postMessage({
        kind: "moves",
        move,
        budget: moveBudget,
        suffix: bestSuffix,
        bestLoss,
        suffixGen
    });
}

function onWorker(worker, message) {
    if (message.error) throw new Error(message.error);
    if (message.suffixGen !== suffixGen) {
        assign(worker);
        return;
    }
    if (message.improved && message.loss < bestLoss) {
        bestLoss = message.loss;
        bestSuffix = message.suffix;
        suffixGen++;
        console.log(bestLoss, bestSuffix);
        remember(bestSuffix);
    }
    assign(worker);
}
