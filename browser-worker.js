import { searchUntilImproved } from "./radiation.js";

let createPromise;

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

self.onmessage = async event => {
    try {
        const create = await loadCreate();
        const { targetGray255, prefix, suffix, options } = event.data;
        self.postMessage(searchUntilImproved({ targetGray255, prefix, suffix, options, create }));
    } catch (error) {
        self.postMessage({ error: error && error.message ? error.message : String(error) });
    }
};
