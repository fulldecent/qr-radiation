import QRCode from "qrcode";
import { parentPort } from "worker_threads";

function loss(targetGray255, message, options) {
    const qrCode = QRCode.create(message, options);
    return targetGray255.reduce((previousValue, currentValue, currentIndex) => {
        return previousValue + (qrCode.modules.data[currentIndex] === 1
            ? currentValue
            : 255 - currentValue)
    }, 0);
}

function irradiate(string) {
    const numDigitsToIrradiate = Math.floor(Math.random() * 5) + 1;
    for (let i=0; i<numDigitsToIrradiate; i++) {
        const digit = String(Math.floor(Math.random() * 10));
        const location = Math.floor(Math.random() * (string.length - 1));
        string = string.substr(0, location) + digit + string.substr(location + 1);
    }
    return string;
}

parentPort.on('message', message => {
    const { targetGray255, prefix, suffix, options } = message;
    const bestLoss = loss(targetGray255, prefix + suffix, options);
    while (true) {
        const candidateSuffix = irradiate(suffix);
        if (candidateSuffix === suffix) continue;
        const candidateLoss = loss(targetGray255, prefix + candidateSuffix, options);
        if (candidateLoss <= bestLoss) {
            parentPort.postMessage({ suffix: candidateSuffix, loss: candidateLoss });
            break;
        }
    }
});