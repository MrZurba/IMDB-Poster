// ==UserScript==
// @name         IMDb Poster Helper
// @namespace    poster-extractor.local
// @version      1.0.1
// @description  Copy or open the poster image URL from IMDb title pages.
// @match        https://www.imdb.com/*
// @match        https://m.imdb.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
  "use strict";

  var state = {
    posterUrl: "",
    attempts: 0
  };

  start();

  function start() {
    if (!document.body) {
      window.setTimeout(start, 250);
      return;
    }

    addPanel();
    findPoster();
  }

  function addPanel() {
    var panel = document.createElement("div");

    panel.id = "imdb-poster-helper-panel";
    panel.innerHTML = ""
      + '<div style="font-weight:bold;margin-bottom:8px;">IMDb Poster</div>'
      + '<button data-action="copy" disabled style="width:100%;margin-bottom:6px;padding:8px;border:0;border-radius:5px;background:#111;color:#f5c518;font-weight:bold;cursor:pointer;">Copy URL</button>'
      + '<button data-action="open" disabled style="width:100%;margin-bottom:6px;padding:8px;border:0;border-radius:5px;background:#111;color:#f5c518;font-weight:bold;cursor:pointer;">Open Poster</button>'
      + '<button data-action="retry" style="width:100%;padding:8px;border:0;border-radius:5px;background:#fff;color:#111;font-weight:bold;cursor:pointer;">Retry</button>'
      + '<div id="imdb-poster-helper-status" style="margin-top:8px;font-size:12px;line-height:1.35;">Loading...</div>';

    panel.style.position = "fixed";
    panel.style.right = "20px";
    panel.style.bottom = "20px";
    panel.style.zIndex = "2147483647";
    panel.style.width = "180px";
    panel.style.background = "#f5c518";
    panel.style.color = "#111";
    panel.style.padding = "14px";
    panel.style.border = "3px solid #111";
    panel.style.borderRadius = "8px";
    panel.style.boxShadow = "0 12px 36px rgba(0,0,0,.45)";
    panel.style.font = "13px Arial, sans-serif";

    panel.addEventListener("click", function (event) {
      var action = event.target && event.target.getAttribute("data-action");

      if (action === "copy") {
        copyPosterUrl();
      }

      if (action === "open") {
        window.open(state.posterUrl, "_blank", "noopener");
      }

      if (action === "retry") {
        state.attempts = 0;
        findPoster();
      }
    });

    document.body.appendChild(panel);
  }

  function findPoster() {
    var posterUrl = extractPosterUrl();

    if (posterUrl) {
      state.posterUrl = posterUrl;
      setStatus("Poster found.");
      setButtons(true);
      return;
    }

    state.attempts += 1;
    setStatus("Looking for poster...");
    setButtons(false);

    if (state.attempts < 15) {
      window.setTimeout(findPoster, 700);
      return;
    }

    setStatus("No poster found. Try Retry.");
  }

  function extractPosterUrl() {
    return cleanImageUrl(extractFromVisiblePoster() || extractFromJsonLd() || extractFromMeta());
  }

  function extractFromJsonLd() {
    var scripts = document.querySelectorAll('script[type="application/ld+json"]');
    var i;

    for (i = 0; i < scripts.length; i += 1) {
      try {
        var data = JSON.parse(scripts[i].textContent);
        var image = findImageInObject(data);

        if (image) {
          return image;
        }
      } catch (error) {
        // Try the next JSON block.
      }
    }

    return "";
  }

  function findImageInObject(value) {
    var i;

    if (!value) {
      return "";
    }

    if (Object.prototype.toString.call(value) === "[object Array]") {
      for (i = 0; i < value.length; i += 1) {
        var imageFromArray = findImageInObject(value[i]);

        if (imageFromArray) {
          return imageFromArray;
        }
      }

      return "";
    }

    if (typeof value === "object" && value.image) {
      return Object.prototype.toString.call(value.image) === "[object Array]" ? value.image[0] : value.image;
    }

    return "";
  }

  function extractFromMeta() {
    var meta = document.querySelector('meta[property="og:image"]') || document.querySelector('meta[name="twitter:image"]');
    return meta ? meta.getAttribute("content") || "" : "";
  }

  function extractFromVisiblePoster() {
    var images = document.querySelectorAll("img");
    var preferred = document.querySelector('[data-testid="hero-media__poster"] img')
      || document.querySelector('[data-testid="poster"] img')
      || document.querySelector('.ipc-poster img');
    var i;
    var src;

    if (preferred) {
      src = bestImageFromElement(preferred);

      if (src) {
        return src;
      }
    }

    for (i = 0; i < images.length; i += 1) {
      src = bestImageFromElement(images[i]);

      if (src) {
        return src;
      }
    }

    return "";
  }

  function bestImageFromElement(image) {
    var srcset = image.getAttribute("srcset") || "";
    var src = image.getAttribute("src") || "";
    var candidates;
    var lastCandidate;
    var url;

    if (srcset.indexOf("m.media-amazon.com/images/") !== -1) {
      candidates = srcset.split(",");
      lastCandidate = candidates[candidates.length - 1].trim().split(/\s+/)[0];
      url = lastCandidate || src;
    } else {
      url = src;
    }

    if (url && url.indexOf("m.media-amazon.com/images/") !== -1) {
      return url;
    }

    return "";
  }

  function cleanImageUrl(url) {
    if (!url) {
      return "";
    }

    return url.replace(/\._V1_[^./]+(?=\.(jpg|jpeg|png|webp))/i, "._V1_");
  }

  function setStatus(message) {
    var status = document.getElementById("imdb-poster-helper-status");

    if (status) {
      status.textContent = message;
    }
  }

  function setButtons(enabled) {
    setButton("copy", enabled);
    setButton("open", enabled);
  }

  function setButton(action, enabled) {
    var button = document.querySelector('#imdb-poster-helper-panel button[data-action="' + action + '"]');

    if (button) {
      button.disabled = !enabled;
      button.style.opacity = enabled ? "1" : ".55";
    }
  }

  function copyPosterUrl() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(state.posterUrl).then(function () {
        setStatus("Copied.");
      }, function () {
        showPromptFallback();
      });
      return;
    }

    showPromptFallback();
  }

  function showPromptFallback() {
    window.prompt("Copy poster URL:", state.posterUrl);
    setStatus("Copy manually from the popup.");
  }
}());
