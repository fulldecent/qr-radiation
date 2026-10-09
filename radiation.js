// Shared by the Node workers and the browser. QR drawing stays outside this file.

export function moduleCount(version) {
    if (!Number.isInteger(version) || version < 1 || version > 40) {
        throw new Error("QR version must be an integer from 1 to 40.");
    }
    return version * 4 + 17;
}

// A black module (1) wants a dark target pixel. A white module wants a light one.
export function loss(targetGray255, modulesData) {
    if (targetGray255.length !== modulesData.length) {
        throw new Error(`Target has ${targetGray255.length} pixels and the QR code has ${modulesData.length} modules. Those lengths must match.`);
    }
    return targetGray255.reduce((previousValue, currentValue, currentIndex) => {
        return previousValue + (modulesData[currentIndex] === 1
            ? currentValue
            : 255 - currentValue);
    }, 0);
}

export function irradiate(string, random = Math.random) {
    const numDigitsToIrradiate = Math.floor(random() * 5) + 1;
    let next = string;
    for (let i = 0; i < numDigitsToIrradiate; i++) {
        const digit = String(Math.floor(random() * 10));
        const location = Math.floor(random() * (string.length - 1));
        next = next.substr(0, location) + digit + next.substr(location + 1);
    }
    return next;
}

// Keep drawing suffixes until one scores as well as, or better than, the input.
export function searchUntilImproved({ targetGray255, prefix, suffix, options, create, random }) {
    const bestLoss = loss(targetGray255, create(prefix + suffix, options).modules.data);
    while (true) {
        const candidateSuffix = irradiate(suffix, random);
        if (candidateSuffix === suffix) continue;
        const candidateLoss = loss(targetGray255, create(prefix + candidateSuffix, options).modules.data);
        if (candidateLoss <= bestLoss) {
            return { suffix: candidateSuffix, loss: candidateLoss };
        }
    }
}
