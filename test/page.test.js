"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { readHtml } = require("./load-core");

const html = readHtml();
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];

test("스크립트는 tally-core(계산)와 tally-ui(화면) 두 개뿐이고 모두 인라인", () => {
  assert.deepEqual(scripts.map((m) => m[1].trim()), ['id="tally-core"', 'id="tally-ui"']);
});

test("계산 로직은 DOM·브라우저 객체를 쓰지 않는다", () => {
  const core = scripts[0][2];
  for (const word of ["document", "window", "navigator", "location", "localStorage", "sessionStorage"]) {
    assert.ok(!new RegExp("\\b" + word + "\\b").test(core), word);
  }
});

test("외부 주소·외부 자원을 불러오지 않는다", () => {
  assert.ok(!/https?:\/\//i.test(html), "http(s) 주소");
  assert.ok(!/(^|[\s"'(=])\/\/[a-z0-9]/i.test(html.replace(/<!--[\s\S]*?-->/g, "").replace(/^\s*\/\/.*$/gm, "")), "// 주소");
  assert.ok(!/<(link|iframe|img|object|embed|form|base)\b/i.test(html), "외부 자원 태그·form");
  assert.ok(!/\bsrc\s*=/i.test(html), "src 속성");
  assert.ok(!/@import|@font-face|url\(/i.test(html), "CSS 외부 자원");
});

test("데이터를 보내거나 저장하는 코드가 없다", () => {
  const code = scripts.map((m) => m[2]).join("\n");
  for (const word of [
    "fetch", "XMLHttpRequest", "sendBeacon", "WebSocket", "EventSource", "postMessage",
    "localStorage", "sessionStorage", "indexedDB", "cookie", "caches", "serviceWorker",
    "innerHTML", "outerHTML", "insertAdjacentHTML", "eval", "Function",
  ]) {
    assert.ok(!new RegExp("\\b" + word + "\\b").test(code), word);
  }
});

test("CSP로 외부 연결을 막는다", () => {
  const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  assert.ok(m, "CSP 메타 태그");
  const csp = m[1];
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /form-action 'none'/);
  assert.match(csp, /base-uri 'none'/);
  assert.ok(!/connect-src|https?:|\*/.test(csp));
});

test("입력칸은 자동완성·맞춤법 검사를 끈다", () => {
  const ta = html.match(/<textarea\b[^>]*>/)[0];
  assert.match(ta, /autocomplete="off"/);
  assert.match(ta, /spellcheck="false"/);
});

test("결과 표 머리글은 문항 / 유효 응답 / 평균 / 빈 응답 / 제외", () => {
  const head = html.match(/<thead>([\s\S]*?)<\/thead>/)[1];
  const labels = [...head.matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map((m) => m[1]);
  assert.deepEqual(labels, ["문항", "유효 응답", "평균", "빈 응답", "제외"]);
});

test("저장소 맨 위에 빈 .nojekyll 파일이 있다", () => {
  const p = path.join(__dirname, "..", ".nojekyll");
  assert.ok(fs.existsSync(p));
  assert.equal(fs.statSync(p).size, 0);
});
