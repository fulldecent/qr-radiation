import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { PNG } from "pngjs";
import { combine, irradiate, loss, moduleCount, searchMoves, searchUntilImproved } from "../radiation.js";

const require = createRequire(import.meta.url);
const QRCode = require("qrcode");

function sequence(values) {
    let index = 0;
    return () => values[index++];
}

test("module count follows the QR version formula", () => {
    assert.equal(moduleCount(1), 21);
    assert.equal(moduleCount(6), 41);
    assert.throws(() => moduleCount(0), /1 to 40/);
    assert.throws(() => moduleCount(1.5), /1 to 40/);
});

test("loss scores dark modules against dark pixels", () => {
    assert.equal(loss([0, 255, 10], [1, 1, 0]), 0 + 255 + (255 - 10));
    assert.throws(() => loss([0], [1, 0]), /must match/);
});

test("irradiate keeps the suffix length and changes only digits", () => {
    const next = irradiate("0000", sequence([0, 0.1, 0]));
    assert.equal(next, "1000");
    assert.match(irradiate("1234567890", Math.random), /^\d{10}$/);
});

test("search stops at the first suffix that does not get worse", () => {
    const target = [255, 255, 255, 255];
    const result = searchUntilImproved({
        targetGray255: target,
        prefix: "",
        suffix: "0000",
        options: {},
        random: sequence([0, 0.1, 0]),
        create(text) {
            const data = text === "1000" ? [0, 0, 0, 0] : [1, 1, 1, 1];
            return { modules: { data } };
        }
    });
    assert.deepEqual(result, { suffix: "1000", loss: 0 });
});

test("the installed encoder and the vendored browser build draw the same modules", () => {
    const source = readFileSync(new URL("../vendor/qrcode.js", import.meta.url), "utf8");
    const packaged = readFileSync(new URL("../node_modules/qrcode/build/qrcode.js", import.meta.url));
    assert.equal(source, packaged.toString("utf8"));
    const browserQRCode = new Function(`${source}\nreturn QRCode;`)();
    const options = { errorCorrectionLevel: "L", maskPattern: 1, version: 6 };
    const text = "https://phor.net/#hour-1";
    const browserModules = browserQRCode.create(text, options).modules.data;
    const nodeModules = QRCode.create(text, options).modules.data;
    assert.equal(browserModules.length, 41 * 41);
    assert.deepEqual(Array.from(browserModules), Array.from(nodeModules));
});

test("a pair is scored once, after both digits change", () => {
    const seen = [];
    const result = searchMoves({
        targetGray255: [0],
        prefix: "",
        suffix: "0000",
        move: "pair",
        budget: 1,
        bestLoss: 1000,
        random: sequence([0, 0.2, 0.5, 0.3]),
        options: {},
        create(text) {
            seen.push(text);
            return { modules: { data: [1] } };
        }
    });
    assert.deepEqual(seen, ["2030"]);
    assert.equal(result.attempts, 1);
    assert.equal(result.improved, true);
    assert.equal(result.candidateSuffix, "2030");
    assert.equal(result.loss, 0);
});

test("a path is scored only at the end of the edits", () => {
    const seen = [];
    combine("0000", "path", sequence([0, 0, 0.2, 0.75, 0.4]));
    searchMoves({
        targetGray255: [0],
        prefix: "",
        suffix: "0000",
        move: "path",
        budget: 1,
        bestLoss: 1000,
        random: sequence([0, 0, 0.2, 0.75, 0.4]),
        options: {},
        create(text) {
            seen.push(text);
            return { modules: { data: [1] } };
        }
    });
    assert.deepEqual(seen, ["2004"]);
});

test("a path that cancels itself is still one finished change", () => {
    const seen = [];
    const result = searchMoves({
        targetGray255: [0],
        prefix: "",
        suffix: "0000",
        move: "path",
        budget: 1,
        bestLoss: 1000,
        random: sequence([0, 0, 0.1, 0, 0, 0.2, 0.3]),
        options: {},
        create(text) {
            seen.push(text);
            return { modules: { data: [1] } };
        }
    });
    assert.deepEqual(seen, ["3000"]);
    assert.equal(result.candidateSuffix, "3000");
});

test("every move batch scores a fixed number of finished strings", () => {
    for (const move of ["single", "pair", "triple", "run", "path"]) {
        for (let seed = 1; seed <= 6; seed++) {
            let creates = 0;
            const result = searchMoves({
                targetGray255: [255],
                prefix: "",
                suffix: "00000",
                move,
                budget: 4,
                bestLoss: 0,
                random: mulberry32(seed + move.length * 17),
                options: {},
                create() {
                    creates++;
                    return { modules: { data: [1] } };
                }
            });
            assert.equal(creates, 4, move);
            assert.equal(result.attempts, 4);
            assert.equal(result.improved, false);
            assert.equal(result.candidateSuffix.length, 5);
        }
    }
});

function mulberry32(seed) {
    return () => {
        seed |= 0;
        seed = seed + 0x6D2B79F5 | 0;
        let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
        value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
        return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
}

test("the sample target and config produce a stable loss and can improve", () => {
    const config = JSON.parse(readFileSync(new URL("../config.json", import.meta.url)));
    const target = PNG.sync.read(readFileSync(new URL("../target.png", import.meta.url)));
    const targetGray255 = target.data.filter((_, index) => index % 4 === 0);
    assert.equal(target.width, moduleCount(config.options.version));
    assert.equal(target.height, moduleCount(config.options.version));
    const create = (text, options) => QRCode.create(text, options);
    const baseline = loss(targetGray255, create(config.prefix + config.suffix, config.options).modules.data);
    assert.equal(baseline, 176319);
    const improved = searchUntilImproved({
        targetGray255,
        prefix: config.prefix,
        suffix: config.suffix,
        options: config.options,
        create,
        random: mulberry32(1)
    });
    assert.equal(improved.suffix.length, config.suffix.length);
    assert.match(improved.suffix, /^\d+$/);
    assert.ok(improved.loss <= baseline);
});
