import * as fs from "fs";
import QRCode from "qrcode";
import{ PNG } from "pngjs";

// Load target /////////////////////////////////////////////////////////////////
const config = JSON.parse(fs.readFileSync("./config.json"));
const targetData = fs.readFileSync("target.png");
const target = PNG.sync.read(targetData);
const targetGray255 = target.data.filter((_, index) => index%4===0); // 1st pixel channel

// Create //////////////////////////////////////////////////////////////////////
const options = {
    errorCorrectionLevel: "L",
    maskPattern: 1,
    margin: 0,
    scale: 1,
    version: config.version,
}
var bestSuffix = config.suffix;
var bestLoss = loss(bestSuffix);

function loss(suffix) {
    const qrcode = QRCode.create(config.prefix + suffix, options);
    return targetGray255.reduce((previousValue, currentValue, currentIndex) => {
        return previousValue + (qrcode.modules.data[currentIndex] === 1
            ? currentValue
            : 255 - currentValue)
    }, 0);
}

function irradiate(string) {
    for (let i=0; i<3; i++) {
        const digit = String(Math.floor(Math.random() * 10));
        const location = Math.floor(Math.random() * (string.length - 1));
        string = string.substr(0, location) + digit + string.substr(location + 1);
    }
    return string;
}

while (true) {
    const candidateSuffix = irradiate(bestSuffix);
    if (candidateSuffix === bestSuffix) continue;
    const candidateLoss = loss(candidateSuffix);
    if (candidateLoss <= bestLoss) {
        bestSuffix = candidateSuffix;
        bestLoss = candidateLoss;
        await QRCode.toFile("best.png", config.prefix + candidateSuffix, options);
        console.log(candidateLoss, config.prefix + candidateSuffix);
    }
}