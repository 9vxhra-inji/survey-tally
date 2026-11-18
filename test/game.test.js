"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const html = fs.readFileSync(path.join(__dirname, "..", "game", "index.html"), "utf8");
const src = html.match(/<script id="game-core">([\s\S]*?)<\/script>/)[1];
const ctx = vm.createContext({});
vm.runInContext(src, ctx);
const T = ctx.TicTacToe;
const plain = (v) => JSON.parse(JSON.stringify(v));
const playAll = (moves) => moves.reduce((s, m) => T.play(s, m), T.newGame());

test("흑이 먼저 두고 차례가 번갈아 바뀐다", () => {
  let s = T.newGame();
  assert.equal(s.turn, "black");
  s = T.play(s, 4);
  assert.equal(s.board[4], "black");
  assert.equal(s.turn, "white");
  s = T.play(s, 0);
  assert.equal(s.board[0], "white");
  assert.equal(s.turn, "black");
});

test("가로·세로·대각선 8줄 모두 승리로 판정한다", () => {
  for (const line of T.LINES) {
    const board = Array(9).fill(null);
    for (const i of line) board[i] = "white";
    assert.deepEqual(plain(T.judge(board)), { winner: "white", line: [...line] });
  }
});

test("가로 3개를 먼저 이은 흑이 이기고, 이긴 뒤엔 더 둘 수 없다", () => {
  const s = playAll([0, 3, 1, 4, 2]);
  assert.equal(s.winner, "black");
  assert.deepEqual(plain(s.line), [0, 1, 2]);
  assert.equal(T.play(s, 8), s);
});

test("판이 다 차고 3개가 없으면 무승부", () => {
  const s = playAll([0, 1, 2, 4, 3, 5, 7, 6, 8]);
  assert.equal(s.winner, "draw");
  assert.equal(s.line, null);
});

test("마지막 수에 3개가 이어지면 무승부가 아니라 승리", () => {
  const s = playAll([0, 1, 2, 4, 3, 5, 6]); // 흑 0·3·6 세로
  assert.equal(s.winner, "black");
});

test("이미 돌이 있는 칸이나 판 밖에는 둘 수 없다", () => {
  const s = T.play(T.newGame(), 4);
  for (const i of [4, -1, 9, 1.5, NaN]) assert.equal(T.play(s, i), s, String(i));
});

test("한 수 무르기", () => {
  const s = playAll([4, 0, 8]);
  const u = T.undo(s);
  assert.deepEqual(plain(u.history), [4, 0]);
  assert.equal(u.board[8], null);
  assert.equal(u.turn, "black");
  assert.deepEqual(plain(T.undo(T.newGame())), plain(T.newGame()));
});

test("게임 페이지는 외부 자원·전송·저장 코드를 쓰지 않는다", () => {
  assert.ok(!/https?:\/\//i.test(html));
  assert.ok(!/<(link|iframe|img|form)\b|\bsrc\s*=|@import|url\(/i.test(html));
  assert.ok(!/\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|localStorage|sessionStorage|indexedDB|cookie|innerHTML|eval)\b/.test(html));
});
