"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadCore } = require("./load-core");

const core = loadCore();
// vm 안에서 만든 객체는 프로토타입이 달라 JSON으로 옮겨 비교한다.
const plain = (v) => JSON.parse(JSON.stringify(v));
const tally = (text) => plain(core.tally(text));
const rowsOf = (text) => plain(core.parseTable(text));
const tsv = (lines) => lines.map((l) => l.join("\t")).join("\r\n") + "\r\n";

test("classifyCell: 1~5는 유효, 앞뒤 공백은 지우고 본다", () => {
  for (const v of ["1", "2", "3", "4", "5", " 3", "4 ", "\t5\t", " 2　"]) {
    assert.equal(core.classifyCell(v), "valid", JSON.stringify(v));
  }
});

test("classifyCell: 비었거나 공백만 있으면 빈 응답", () => {
  for (const v of ["", " ", "   ", "\t", "　", undefined, null]) {
    assert.equal(core.classifyCell(v), "blank", JSON.stringify(v));
  }
});

test("classifyCell: 그 밖의 값은 제외", () => {
  for (const v of ["0", "6", "10", "01", "3.0", "3.", "+3", "-1", "１", "3 4", "예", "N/A", "\"3\""]) {
    assert.equal(core.classifyCell(v), "excluded", JSON.stringify(v));
  }
});

test("formatAverage: 소수 셋째 자리에서 반올림해 둘째 자리까지", () => {
  assert.equal(core.formatAverage(0, 0), "-");
  assert.equal(core.formatAverage(3, 1), "3.00");
  assert.equal(core.formatAverage(7, 3), "2.33"); // 2.333…
  assert.equal(core.formatAverage(8, 3), "2.67"); // 2.666…
  assert.equal(core.formatAverage(469, 200), "2.35"); // 2.345 → 올림
  assert.equal(core.formatAverage(201, 200), "1.01"); // 1.005 → 올림(부동소수 함정)
  assert.equal(core.formatAverage(9, 2), "4.50");
  assert.equal(core.formatAverage(5, 1), "5.00");
  assert.equal(core.formatAverage(1001, 1000), "1.00"); // 1.001 → 버림
});

test("tally: 기본 집계와 첫 열 제외", () => {
  const result = tally(tsv([
    ["응답번호", "만족도", "추천 의향"],
    ["1", "5", "4"],
    ["2", "3", ""],
    ["3", "4", "모름"],
    ["4", " 2 ", "6"],
  ]));
  assert.equal(result.ok, true);
  assert.equal(result.responseCount, 4);
  assert.deepEqual(result.questions, [
    { column: 2, name: "만족도", valid: 4, average: "3.50", blank: 0, excluded: 0 },
    { column: 3, name: "추천 의향", valid: 1, average: "4.00", blank: 1, excluded: 2 },
  ]);
});

test("tally: 첫 열 값은 1~5라도 집계하지 않는다", () => {
  const result = tally(tsv([["번호", "Q1"], ["1", "2"], ["5", "4"]]));
  assert.equal(result.questions.length, 1);
  assert.equal(result.questions[0].name, "Q1");
  assert.equal(result.questions[0].average, "3.00");
});

test("tally: 유효가 0이면 평균은 \"-\"", () => {
  const result = tally(tsv([["번호", "Q1"], ["1", ""], ["2", "x"]]));
  assert.deepEqual(result.questions[0], { column: 2, name: "Q1", valid: 0, average: "-", blank: 1, excluded: 1 });
});

test("tally: 칸이 모자란 줄은 모자란 칸을 빈 응답으로 센다", () => {
  const text = "번호\tQ1\tQ2\tQ3\n1\t5\n2\n3\t1\t2\t3\n";
  const q = tally(text).questions;
  assert.deepEqual(q.map((x) => [x.valid, x.blank, x.excluded]), [
    [2, 1, 0],
    [1, 2, 0],
    [1, 2, 0],
  ]);
});

test("tally: 머리글보다 많은 칸은 무시한다", () => {
  const q = tally("번호\tQ1\n1\t2\t5\t5\n").questions;
  assert.equal(q.length, 1);
  assert.deepEqual([q[0].valid, q[0].average], [1, "2.00"]);
});

test("tally: 줄바꿈 \\r\\n · \\n · \\r 모두 읽고, 끝의 빈 줄은 응답이 아니다", () => {
  for (const nl of ["\r\n", "\n", "\r"]) {
    const result = tally(["번호\tQ1", "1\t4", "2\t2", "", ""].join(nl));
    assert.equal(result.responseCount, 2, JSON.stringify(nl));
    assert.equal(result.questions[0].average, "3.00");
  }
});

test("tally: 탭만 있는 줄은 응답 줄이고 모두 빈 응답", () => {
  const result = tally("번호\tQ1\tQ2\n\t\t\n1\t3\t3\n");
  assert.equal(result.responseCount, 2);
  assert.deepEqual(result.questions.map((x) => x.blank), [1, 1]);
});

test("tally: 엑셀이 따옴표로 감싼 칸(줄바꿈·탭·따옴표 포함)은 한 칸", () => {
  const text = '번호\t"좋았던\n점"\tQ2\r\n1\t"그냥\t""좋음""\n이었다"\t5\r\n2\t3\t4\r\n';
  const rows = rowsOf(text);
  assert.deepEqual(rows, [
    ["번호", "좋았던\n점", "Q2"],
    ["1", '그냥\t"좋음"\n이었다', "5"],
    ["2", "3", "4"],
  ]);
  const result = tally(text);
  assert.equal(result.responseCount, 2);
  assert.deepEqual(result.questions.map((x) => [x.name, x.valid, x.excluded, x.average]), [
    ["좋았던\n점", 1, 1, "3.00"],
    ["Q2", 2, 0, "4.50"],
  ]);
});

test("parseTable: 닫히지 않거나 뒤에 글자가 붙은 따옴표는 글자 그대로", () => {
  assert.deepEqual(rowsOf('a\t"3\nb\tc'), [["a", '"3'], ["b", "c"]]);
  assert.deepEqual(rowsOf('a\t"3"x\tb'), [["a", '"3"x', "b"]]);
  assert.deepEqual(rowsOf('a\tx"y"\tb'), [["a", 'x"y"', "b"]]);
});

test("parseTable: 맨 앞 BOM은 지운다", () => {
  assert.deepEqual(rowsOf("﻿번호\tQ1\n1\t2"), [["번호", "Q1"], ["1", "2"]]);
});

test("tally: 문항 이름은 앞뒤 공백을 지우고, 비면 열 번호로 부른다", () => {
  const q = tally("번호\t  Q1  \t \n1\t1\t2\n").questions;
  assert.deepEqual(q.map((x) => x.name), ["Q1", "(이름 없음 3열)"]);
});

test("tally: 머리글만 있으면 모두 0과 \"-\"", () => {
  const result = tally("번호\tQ1\tQ2\r\n");
  assert.equal(result.responseCount, 0);
  assert.deepEqual(result.questions.map((x) => [x.valid, x.average, x.blank, x.excluded]), [
    [0, "-", 0, 0],
    [0, "-", 0, 0],
  ]);
});

test("tally: 빈 입력과 문항이 없는 입력", () => {
  assert.deepEqual(tally(""), { ok: false, reason: "empty" });
  assert.deepEqual(tally("\r\n\n"), { ok: false, reason: "empty" });
  assert.deepEqual(tally("번호\n1\n2\n"), { ok: false, reason: "no-questions" });
});

test("tally: 칸 수 합계는 응답 줄 수와 같다", () => {
  const lines = [["번호", "A", "B", "C"]];
  const values = ["1", "5", "", " ", "x", "0", "3.5", "4"];
  for (let i = 0; i < 200; i++) {
    const row = [String(i + 1)];
    const len = i % 4; // 칸 모자란 줄 섞기
    for (let k = 0; k < len; k++) row.push(values[(i * 7 + k * 3) % values.length]);
    lines.push(row);
  }
  const result = tally(tsv(lines));
  assert.equal(result.responseCount, 200);
  for (const q of result.questions) assert.equal(q.valid + q.blank + q.excluded, 200);
});

test("tally: 큰 입력도 빠르게 처리한다", () => {
  const header = ["번호"];
  for (let q = 1; q <= 50; q++) header.push("Q" + q);
  const lines = [header];
  for (let i = 0; i < 5000; i++) {
    const row = [String(i + 1)];
    for (let q = 1; q <= 50; q++) row.push(String(((i + q) % 5) + 1));
    lines.push(row);
  }
  const start = Date.now();
  const result = tally(tsv(lines));
  assert.equal(result.responseCount, 5000);
  assert.equal(result.questions[0].average, "3.00");
  assert.ok(Date.now() - start < 2000);
});
