import * as fs from "fs";
import QRCode from "qrcode";
import{ PNG } from "pngjs";
import { Worker, parentPort } from "worker_threads";
import { cpus } from 'os';
const numCPUs = cpus().length;

// Load target /////////////////////////////////////////////////////////////////
const config = JSON.parse(fs.readFileSync("./config.json"));
const target = PNG.sync.read(fs.readFileSync("target.png"));
const targetGray255 = target.data.filter((_, index) => index%4===0); // 1st pixel channel
var bestSuffix = config.suffix;

// Delegate to workers, synchronize each progress //////////////////////////////
const workers = [];
function startWorkers() {
    for (let i=0; i<numCPUs; i++) {
        const worker = new Worker("./worker.mjs");
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
    startWorkers();
}

startWorkers();