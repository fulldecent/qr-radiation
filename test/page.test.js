import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("the page includes the browser controls and local scripts", () => {
    const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
    for (const id of ["prefix", "suffix", "version", "error-correction", "mask", "target", "start", "stop", "loss", "qr", "attempt", "attempt-loss", "url"]) {
        assert.match(html, new RegExp(`id="${id}"`));
    }
    assert.match(html, /src="vendor\/qrcode\.js"/);
    assert.match(html, /src="app\.js"/);
    assert.match(html, /name="qr-radiation-app"/);
    assert.match(html, /bootstrap@6\.0\.0-alpha\.1\/dist\/css\/bootstrap\.min\.css/);
    assert.match(html, /id="start"[^>]*type="button"/);
    assert.match(html, /lg:col-6 order-1 lg:order-2/);
    assert.equal(html.includes("{{"), false);
    readFileSync(new URL("../app.js", import.meta.url));
    readFileSync(new URL("../browser-worker.js", import.meta.url));
    readFileSync(new URL("../vendor/qrcode.js", import.meta.url));
});
