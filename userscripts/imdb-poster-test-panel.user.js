// ==UserScript==
// @name         IMDb Poster TEST PANEL
// @namespace    poster-extractor.local
// @version      0.1.0
// @description  Minimal IMDb test panel.
// @match        https://www.imdb.com/*
// @match        https://m.imdb.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
  var panel = document.createElement("div");
  panel.textContent = "IMDb userscript is running";
  panel.style.position = "fixed";
  panel.style.right = "20px";
  panel.style.bottom = "20px";
  panel.style.zIndex = "2147483647";
  panel.style.background = "#f5c518";
  panel.style.color = "#111";
  panel.style.padding = "14px";
  panel.style.border = "3px solid #111";
  panel.style.borderRadius = "8px";
  panel.style.font = "bold 16px Arial, sans-serif";
  document.body.appendChild(panel);
}());
