// ==UserScript==
// @name         IMDb Poster Helper
// @namespace    poster-extractor.local
// @version      1.1.0
// @description  Show an IMDb poster helper panel and copy the poster URL.
// @author       MrZurba
// @match        https://www.imdb.com/*
// @match        https://m.imdb.com/*
// @match        https://imdb.com/*
// @grant        GM_setClipboard
// @run-at       document-end
// ==/UserScript==

(function () {
  "use strict";

  var state = {
    posterUrl: "",
    title: "",
    attempts: 0
  };

  startWhenReady();

  function startWhenReady() {
    if (!document.body) {
      window.setTimeout(startWhenReady, 250);
      return;
    }

    if (document.getElementById("imdb-poster-helper-panel")) {
      return;
    }

    renderPanel();
    findPosterWithRetry();
  }

  function findPosterWithRetry() {
    var poster = extractPoster();

    if (poster.url) {
      state.posterUrl = poster.url;
      state.title = poster.title || document.title.replace(/\s*-\s*IMDb\s*$/i, "");
      setStatus("Poster found.");
      setButtonsEnabled(true);
      return;
    }

    state.attempts += 1;
    setStatus("Looking for poster...");
    setButtonsEnabled(false);

    if (state.attempts < 15) {
      window.setTimeout(findPosterWithRetry, 700);
      return;
    }

    setStatus("No poster found. Refresh or click Retry.");
    setButtonsEnabled(false);
  }

  function extractPoster() {
    var fromJson = extractFromJsonLd();
    var metaPoster;

    if (fromJson.url) {
      return fromJson;
    }

    metaPoster = getMetaContent('meta[property="og:image"]') || getMetaContent('meta[name="twitter:image"]');

    return {
      url: cleanImdbImageUrl(metaPoster || ""),
      title: getMetaContent('meta[property="og:title"]') || ""
    };
  }

  function extractFromJsonLd() {
    var scripts = document.querySelectorAll('script[type="application/ld+json"]');
    var i;

    for (i = 0; i < scripts.length; i += 1) {
      try {
        var data = JSON.parse(scripts[i].textContent);
        var item = findItemWithImage(data);
        var image = "";

        if (item && item.image) {
          image = Object.prototype.toString.call(item.image) === "[object Array]" ? item.image[0] : item.image;
        }

        if (typeof image === "string" && image.length > 0) {
          return {
            url: cleanImdbImageUrl(image),
            title: typeof item.name === "string" ? item.name : ""
          };
        }
      } catch (error) {
        // Keep trying other JSON-LD blocks.
      }
    }

    return { url: "", title: "" };
  }

  function findItemWithImage(data) {
    var i;

    if (Object.prototype.toString.call(data) !== "[object Array]") {
      return data;
    }

    for (i = 0; i < data.length; i += 1) {
      if (data[i] && data[i].image) {
        return data[i];
      }
    }

    return null;
  }

  function getMetaContent(selector) {
    var element = document.querySelector(selector);
    return element ? element.getAttribute("content") || "" : "";
  }

  function cleanImdbImageUrl(url) {
    return url.replace(/\._V1_[^./]+(?=\.(jpg|jpeg|png|webp))/i, "._V1_");
  }

  function renderPanel() {
    var style = document.createElement("style");
    var panel = document.createElement("div");

    style.textContent = ""
      + "#imdb-poster-helper-panel{position:fixed;right:16px;bottom:16px;z-index:2147483647;width:172px;padding:12px;display:block;background:#151515;color:#fff;border:2px solid #f5c518;border-radius:8px;box-shadow:0 12px 36px rgba(0,0,0,.45);font:13px Arial,sans-serif;text-align:left;}"
      + "#imdb-poster-helper-panel strong{display:block;margin:0 0 8px;font-size:14px;}"
      + "#imdb-poster-helper-panel button{display:block;width:100%;margin:6px 0 0;padding:8px;border:0;border-radius:5px;background:#f5c518;color:#111;cursor:pointer;font:bold 13px Arial,sans-serif;}"
      + "#imdb-poster-helper-panel button:disabled{opacity:.55;cursor:not-allowed;}"
      + "#imdb-poster-helper-panel .iph-status{margin-top:8px;color:#ddd;font-size:12px;line-height:1.35;word-break:break-word;}";

    panel.id = "imdb-poster-helper-panel";
    panel.innerHTML = ""
      + "<strong>IMDb Poster</strong>"
      + '<button type="button" data-action="copy" disabled>Copy URL</button>'
      + '<button type="button" data-action="open" disabled>Open Poster</button>'
      + '<button type="button" data-action="retry">Retry</button>'
      + '<div class="iph-status">Loading...</div>';

    document.head.appendChild(style);
    document.body.appendChild(panel);

    panel.addEventListener("click", function (event) {
      var target = event.target;
      var action;

      if (!target || target.tagName.toLowerCase() !== "button") {
        return;
      }

      action = target.getAttribute("data-action");

      if (action === "copy") {
        copyText(state.posterUrl);
        setStatus("Copied.");
      }

      if (action === "open") {
        window.open(state.posterUrl, "_blank", "noopener");
      }

      if (action === "retry") {
        state.attempts = 0;
        findPosterWithRetry();
      }
    });
  }

  function setButtonsEnabled(enabled) {
    var copyButton = document.querySelector('#imdb-poster-helper-panel button[data-action="copy"]');
    var openButton = document.querySelector('#imdb-poster-helper-panel button[data-action="open"]');

    if (copyButton) {
      copyButton.disabled = !enabled;
    }

    if (openButton) {
      openButton.disabled = !enabled;
    }
  }

  function setStatus(message) {
    var status = document.querySelector("#imdb-poster-helper-panel .iph-status");

    if (status) {
      status.textContent = message;
    }
  }

  function copyText(text) {
    if (typeof GM_setClipboard === "function") {
      GM_setClipboard(text);
      return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    }
  }
}());
