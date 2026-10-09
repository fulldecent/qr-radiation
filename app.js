import { loss, moduleCount } from "./radiation.js";

const form = document.querySelector("#controls");
const prefixInput = document.querySelector("#prefix");
const suffixInput = document.querySelector("#suffix");
const versionInput = document.querySelector("#version");
const errorCorrectionInput = document.querySelector("#error-correction");
const maskInput = document.querySelector("#mask");
const targetInput = document.querySelector("#target");
const targetPreview = document.querySelector("#target-preview");
const requirement = document.querySelector("#requirement");
const startButton = document.querySelector("#start");
const stopButton = document.querySelector("#stop");
const lossOutput = document.querySelector("#loss");
const urlOutput = document.querySelector("#url");
const openLink = document.querySelector("#open");
const statusOutput = document.querySelector("#status");
const logOutput = document.querySelector("#log");
const canvas = document.querySelector("#qr");
const downloadLink = document.querySelector("#download");

let targetGray255 = null;
let targetWidth = 0;
let targetHeight = 0;
let workers = [];
let generation = 0;
let running = false;

function readOptions() {
    return {
        errorCorrectionLevel: errorCorrectionInput.value,
        maskPattern: Number(maskInput.value),
        margin: 0,
        scale: 1,
        version: Number(versionInput.value)
    };
}

function currentURL() {
    return prefixInput.value + suffixInput.value;
}

function setStatus(text) {
    statusOutput.textContent = text;
}

function grayFromImage(image) {
    const sample = document.createElement("canvas");
    sample.width = image.naturalWidth;
    sample.height = image.naturalHeight;
    const context = sample.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
    const gray = new Uint8Array(sample.width * sample.height);
    for (let i = 0; i < gray.length; i++) {
        gray[i] = pixels[i * 4];
    }
    return gray;
}

function drawQR(modulesData, size) {
    const scale = 8;
    canvas.width = size * scale;
    canvas.height = size * scale;
    const context = canvas.getContext("2d");
    const sample = document.createElement("canvas");
    sample.width = size;
    sample.height = size;
    const sampleContext = sample.getContext("2d");
    const image = sampleContext.createImageData(size, size);
    for (let i = 0; i < modulesData.length; i++) {
        const value = modulesData[i] ? 0 : 255;
        image.data[i * 4] = value;
        image.data[i * 4 + 1] = value;
        image.data[i * 4 + 2] = value;
        image.data[i * 4 + 3] = 255;
    }
    sampleContext.putImageData(image, 0, 0);
    context.imageSmoothingEnabled = false;
    context.drawImage(sample, 0, 0, canvas.width, canvas.height);
    downloadLink.href = canvas.toDataURL("image/png");
}

function renderQR() {
    let options;
    let side;
    try {
        options = readOptions();
        side = moduleCount(options.version);
    } catch (error) {
        startButton.disabled = true;
        requirement.textContent = error.message;
        return { ok: false, reason: error.message };
    }
    const sizeMatches = targetGray255 && targetWidth === side && targetHeight === side;
    requirement.textContent = targetGray255
        ? `Version ${options.version} uses ${side}×${side} modules. The target image is ${targetWidth}×${targetHeight}.`
        : `Version ${options.version} uses ${side}×${side} modules.`;
    startButton.disabled = running || !sizeMatches;
    if (!sizeMatches) {
        return { ok: false, reason: requirement.textContent };
    }
    let qr;
    try {
        qr = QRCode.create(currentURL(), options);
    } catch (error) {
        startButton.disabled = true;
        return { ok: false, reason: error.message };
    }
    drawQR(qr.modules.data, qr.modules.size);
    const score = loss(targetGray255, qr.modules.data);
    lossOutput.textContent = String(score);
    urlOutput.textContent = currentURL();
    openLink.href = currentURL();
    return { ok: true, score };
}

function stopWorkers() {
    generation += 1;
    running = false;
    for (const worker of workers) {
        worker.terminate();
    }
    workers = [];
    stopButton.disabled = true;
    renderQR();
}

function startWorkers() {
    const options = readOptions();
    const rendered = renderQR();
    if (!rendered.ok) {
        setStatus(rendered.reason);
        return;
    }
    stopWorkers();
    running = true;
    startButton.disabled = true;
    stopButton.disabled = false;
    const gen = generation;
    const count = navigator.hardwareConcurrency || 4;
    setStatus(`Searching with ${count} workers.`);
    const payload = {
        targetGray255,
        prefix: prefixInput.value,
        suffix: suffixInput.value,
        options
    };
    for (let i = 0; i < count; i++) {
        const worker = new Worker(new URL("./browser-worker.js", import.meta.url), { type: "module" });
        worker.onmessage = event => {
            if (gen !== generation) return;
            suffixInput.value = event.data.suffix;
            const line = `${event.data.loss} ${event.data.suffix}`;
            logOutput.textContent = `${line}\n${logOutput.textContent}`.split("\n").slice(0, 20).join("\n");
            startWorkers();
        };
        worker.onerror = event => {
            if (gen !== generation) return;
            const message = event.message || "The search stopped.";
            stopWorkers();
            setStatus(message);
        };
        workers.push(worker);
        worker.postMessage(payload);
    }
}

function useImage(image) {
    targetWidth = image.naturalWidth;
    targetHeight = image.naturalHeight;
    const preview = document.createElement("canvas");
    preview.width = image.naturalWidth;
    preview.height = image.naturalHeight;
    preview.getContext("2d").drawImage(image, 0, 0);
    targetPreview.src = preview.toDataURL("image/png");
    targetPreview.hidden = false;
    targetGray255 = grayFromImage(image);
    const rendered = renderQR();
    if (!running) {
        setStatus(rendered.ok ? "Ready." : rendered.reason);
    }
}

function loadImage(url) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Could not load ${url}.`));
        image.src = url;
    });
}

form.addEventListener("submit", event => {
    event.preventDefault();
    startWorkers();
});

stopButton.addEventListener("click", () => {
    stopWorkers();
    setStatus("Stopped.");
});

for (const input of [prefixInput, suffixInput, versionInput, errorCorrectionInput, maskInput]) {
    input.addEventListener("input", () => {
        if (running) stopWorkers();
        renderQR();
        if (!running) setStatus("Ready.");
    });
}

targetInput.addEventListener("change", async () => {
    const file = targetInput.files && targetInput.files[0];
    if (!file) return;
    if (running) stopWorkers();
    const url = URL.createObjectURL(file);
    try {
        useImage(await loadImage(url));
    } catch (error) {
        setStatus(error.message);
    } finally {
        URL.revokeObjectURL(url);
    }
});

try {
    const response = await fetch(new URL("./config.json", import.meta.url));
    if (!response.ok) {
        throw new Error("Could not load config.json.");
    }
    const config = await response.json();
    prefixInput.value = config.prefix;
    suffixInput.value = config.suffix;
    versionInput.value = String(config.options.version);
    errorCorrectionInput.value = config.options.errorCorrectionLevel;
    maskInput.value = String(config.options.maskPattern);
    useImage(await loadImage(new URL("./target.png", import.meta.url).href));
} catch (error) {
    setStatus(error.message);
}
