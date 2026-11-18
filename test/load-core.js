"use strict";
// index.html에서 <script id="tally-core"> 블록만 꺼내 Node vm에서 실행한다.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const HTML_PATH = path.join(__dirname, "..", "index.html");

function readHtml() {
  return fs.readFileSync(HTML_PATH, "utf8");
}

function loadCore() {
  const html = readHtml();
  const match = html.match(/<script id="tally-core">([\s\S]*?)<\/script>/);
  if (!match) throw new Error("index.html에 tally-core 스크립트가 없습니다");
  const context = vm.createContext({});
  vm.runInContext(match[1], context, { filename: "index.html#tally-core" });
  return context.SurveyTally;
}

module.exports = { HTML_PATH, readHtml, loadCore };
