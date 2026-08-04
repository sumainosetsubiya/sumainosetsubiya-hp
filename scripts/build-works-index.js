#!/usr/bin/env node
/**
 * scripts/build-works-index.js
 * ---------------------------------------------------------------
 * Decap CMS の folder collection「施工実績」(content/works/*.json、
 * 1件=1ファイル) を読み込み、公開サイト側（js/works.js）が期待する
 * 単一ファイル形式 content/works.json ({ "works": [ ...] }) を
 * 自動生成するビルドスクリプト。
 *
 * 依存パッケージなし・素の Node.js (fs / path のみ) で動作する。
 * Cloudflare Pages のビルドコマンドとして
 *   node scripts/build-works-index.js
 * を設定することで、Decap CMS 側で施工実績を追加・編集して
 * GitHub にコミットされるたびに、この内容が自動的に反映される。
 *
 * 実行方法:
 *   node scripts/build-works-index.js
 *   （または package.json 経由で: npm run build）
 *
 * content/works/ 配下の *.json をファイル名の昇順で読み込み、
 * その後 date フィールド（施工日）の降順で並べ替えて出力する。
 * 日付が空・不正なエントリは末尾にまとめる。
 * 公開側 (js/works.js) は取得後に改めて日付降順ソートを行うため
 * 出力側の並び順は必須ではないが、生成物を人間が読んだ時に
 * わかりやすいよう、あらかじめ新しい順に並べて出力する。
 */

"use strict";

const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const WORKS_DIR = path.join(PROJECT_ROOT, "content", "works");
const OUTPUT_PATH = path.join(PROJECT_ROOT, "content", "works.json");

// content/works.json のエントリとして出力する際のキー順序。
// Decap CMS の config.yml (works コレクション) のフィールド順と揃えてある。
const FIELD_ORDER = [
  "date",
  "area",
  "category",
  "manufacturer",
  "model",
  "duration",
  "before_image",
  "after_image",
  "note",
];

function readWorksDir() {
  if (!fs.existsSync(WORKS_DIR)) {
    throw new Error(
      "施工実績フォルダが見つかりません: " + WORKS_DIR + "\n" +
      "（content/works/ に *.json ファイルが必要です）"
    );
  }

  const fileNames = fs
    .readdirSync(WORKS_DIR)
    .filter(function (name) {
      return name.toLowerCase().endsWith(".json");
    })
    .sort();

  if (fileNames.length === 0) {
    throw new Error(
      "施工実績フォルダにJSONファイルが1件もありません: " + WORKS_DIR
    );
  }

  const works = [];
  fileNames.forEach(function (fileName) {
    const filePath = path.join(WORKS_DIR, fileName);
    const raw = fs.readFileSync(filePath, "utf8");
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(
        "JSONの解析に失敗しました: " + filePath + "\n  " + err.message
      );
    }
    works.push(normalizeEntry(parsed, fileName));
  });

  return works;
}

// 出力するキーの順序を揃え、想定外の余分なキーが混ざっていた場合も
// 末尾にそのまま残す（データを欠落させないため）。
function normalizeEntry(entry, fileName) {
  const ordered = {};
  FIELD_ORDER.forEach(function (key) {
    ordered[key] = Object.prototype.hasOwnProperty.call(entry, key)
      ? entry[key]
      : "";
  });
  Object.keys(entry).forEach(function (key) {
    if (FIELD_ORDER.indexOf(key) === -1) {
      ordered[key] = entry[key];
    }
  });
  // デバッグ用の由来情報（出力JSONには含めない）。破損検知のみに使う。
  void fileName;
  return ordered;
}

// 施工日（"YYYY-MM-DD"）の降順で並び替える。空・不正な日付は末尾に回す。
function sortByDateDesc(works) {
  return works.slice().sort(function (a, b) {
    const timeA = parseDateToTime(a.date);
    const timeB = parseDateToTime(b.date);
    const invalidA = timeA === null;
    const invalidB = timeB === null;

    if (invalidA && invalidB) return 0;
    if (invalidA) return 1;
    if (invalidB) return -1;
    return timeB - timeA;
  });
}

function parseDateToTime(dateStr) {
  if (!dateStr) return null;
  const time = new Date(dateStr).getTime();
  return isNaN(time) ? null : time;
}

function main() {
  const works = readWorksDir();
  const sorted = sortByDateDesc(works);
  const output = { works: sorted };
  const json = JSON.stringify(output, null, 2) + "\n";

  fs.writeFileSync(OUTPUT_PATH, json, "utf8");

  console.log(
    "[build-works-index] " +
      sorted.length +
      " 件の施工実績を " +
      path.relative(PROJECT_ROOT, OUTPUT_PATH) +
      " に書き出しました。"
  );
}

main();
