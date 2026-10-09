import { searchMoves } from "./radiation.js";

let createPromise;
let create;
let state;

function loadCreate() {
    if (!createPromise) {
        createPromise = fetch(new URL("./vendor/qrcode.js", import.meta.url)).then(async response => {
            if (!response.ok) {
                throw new Error("Could not load vendor/qrcode.js.");
            }
            const source = await response.text();
            const QRCode = new Function(`${source}\nreturn QRCode;`)();
            return QRCode.create;
        });
    }
    return createPromise;
}

// Handle one message at a time so a position search cannot start before init.
let pending = Promise.resolve();

self.onmessage = event => {
    pending = pending.then(() => handle(event.data)).catch(error => {
        self.postMessage({ error: error && error.message ? error.message : String(error), suffixGen: event.data && event.data.suffixGen });
    });
};

async function handle(message) {
    if (!create) create = await loadCreate();
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
        create,
        suffix: message.suffix,
        bestLoss: message.bestLoss
    };
    const result = searchMoves({ ...common, move: message.move, budget: message.budget });
    self.postMessage({ ...result, suffixGen: message.suffixGen });
}
