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

export const moveKinds = ["single", "pair", "triple", "run", "path"];

function randomDigit(current, random) {
    let digit = Math.floor(random() * 10);
    if (String(digit) === current) digit = (digit + 1 + Math.floor(random() * 9)) % 10;
    return String(digit);
}

function writeDigit(chars, index, random) {
    chars[index] = randomDigit(chars[index], random);
}

// Build a finished suffix. Nothing in the middle of a pair, run, or path is scored.
export function combine(string, kind, random = Math.random) {
    const chars = string.split("");
    const length = chars.length;
    if (length === 0) return string;
    if (kind === "single") {
        writeDigit(chars, Math.floor(random() * length), random);
    } else if (kind === "pair" || kind === "triple") {
        const count = kind === "pair" ? 2 : 3;
        const used = new Set();
        for (let i = 0; i < count; i++) {
            let index = Math.floor(random() * length);
            let guard = 0;
            while (used.has(index) && used.size < length && guard < 8) {
                index = Math.floor(random() * length);
                guard++;
            }
            used.add(index);
            writeDigit(chars, index, random);
        }
    } else if (kind === "run") {
        const run = 2 + Math.floor(random() * 3);
        const start = Math.floor(random() * length);
        for (let i = 0; i < run && i < length; i++) writeDigit(chars, (start + i) % length, random);
    } else if (kind === "path") {
        const steps = 2 + Math.floor(random() * 5);
        for (let i = 0; i < steps; i++) writeDigit(chars, Math.floor(random() * length), random);
    } else {
        throw new Error(`Unknown move ${kind}.`);
    }
    if (chars.join("") === string) {
        writeDigit(chars, Math.floor(random() * length), random);
    }
    return chars.join("");
}

// Score finished combinations against the current best. Intermediate edits are not scored.
export function searchMoves({ targetGray255, prefix, suffix, options, create, random, move, budget, bestLoss }) {
    const draw = random || Math.random;
    let bestSuffix = suffix;
    let best = bestLoss;
    let attempts = 0;
    let candidateSuffix = suffix;
    let candidateLoss = bestLoss;
    for (let i = 0; i < budget; i++) {
        const next = combine(suffix, move, draw);
        attempts++;
        if (next === suffix) continue;
        candidateSuffix = next;
        candidateLoss = loss(targetGray255, create(prefix + next, options).modules.data);
        if (candidateLoss < best) {
            best = candidateLoss;
            bestSuffix = next;
        }
    }
    return {
        attempts,
        improved: bestSuffix !== suffix,
        suffix: bestSuffix,
        loss: best,
        candidateSuffix,
        candidateLoss,
        move
    };
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
