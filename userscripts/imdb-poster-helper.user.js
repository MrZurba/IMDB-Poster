// ==UserScript==
// @name         IMDb Poster Helper
// @namespace    poster-extractor.local
// @version      1.0.7
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
    firstImageUrl: "",
    attempts: 0,
    panel: null,
    status: null
  };

  start();

  function start() {
    try {
      if (!document.body) {
        window.setTimeout(start, 250);
        return;
      }

      addPanel();
      findPoster();
    } catch (error) {
      showStartupError(error);
    }
  }

  function addPanel() {
    var panel = document.createElement("div");
    var oldPanels = document.querySelectorAll("#imdb-poster-helper-panel");
    var i;

    for (i = 0; i < oldPanels.length; i += 1) {
      if (oldPanels[i].parentNode) {
        oldPanels[i].parentNode.removeChild(oldPanels[i]);
      }
    }

    panel.id = "imdb-poster-helper-panel";
    panel.innerHTML = ""
      + '<div style="font-weight:bold;margin-bottom:8px;">IMDb Poster v1.0.7</div>'
      + '<button data-action="copy" disabled style="width:100%;margin-bottom:6px;padding:8px;border:0;border-radius:5px;background:#111;color:#f5c518;font-weight:bold;cursor:pointer;">Copy URL</button>'
      + '<button data-action="open" disabled style="width:100%;margin-bottom:6px;padding:8px;border:0;border-radius:5px;background:#111;color:#f5c518;font-weight:bold;cursor:pointer;">Open Poster</button>'
      + '<button data-action="first" style="width:100%;margin-bottom:6px;padding:8px;border:0;border-radius:5px;background:#fff;color:#111;font-weight:bold;cursor:pointer;">Use First Image</button>'
      + '<button data-action="retry" style="width:100%;padding:8px;border:0;border-radius:5px;background:#fff;color:#111;font-weight:bold;cursor:pointer;">Retry</button>'
      + '<button data-action="debug" style="width:100%;margin-top:6px;padding:8px;border:0;border-radius:5px;background:#fff;color:#111;font-weight:bold;cursor:pointer;">Debug</button>'
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

      if (action === "first") {
        useFirstImage();
      }

      if (action === "debug") {
        showDebugInfo();
      }
    });

    document.body.appendChild(panel);
    state.panel = panel;
    state.status = panel.querySelector("#imdb-poster-helper-status");
  }

  function findPoster() {
    var posterUrl = "";

    try {
      posterUrl = extractPosterUrl();
    } catch (error) {
      setStatus("Error: " + error.message);
      return;
    }

    if (posterUrl) {
      state.posterUrl = posterUrl;
      setStatus("Poster found: " + shortUrl(posterUrl));
      setButtons(true);
      return;
    }

    state.attempts += 1;
    setStatus("Looking for poster... " + state.attempts + "/15");
    setButtons(false);

    if (state.attempts < 15) {
      window.setTimeout(findPoster, 700);
      return;
    }

    setStatus("No poster found. Try Retry.");
  }

  function extractPosterUrl() {
    return cleanImageUrl(extractHeroPosterByPosition() || extractFromVisiblePoster() || extractFromJsonLd() || extractFromMeta() || extractFromPageHtml());
  }

  function extractHeroPosterByPosition() {
    var images = document.querySelectorAll("img");
    var bestUrl = "";
    var bestScore = -1;
    var i;

    for (i = 0; i < images.length; i += 1) {
      var src = bestImageFromElement(images[i]);
      var rect = images[i].getBoundingClientRect();
      var width = rect.width || images[i].width || 0;
      var height = rect.height || images[i].height || 0;
      var score = 0;

      if (!src || src.indexOf("m.media-amazon.com/images/M/") === -1) {
        continue;
      }

      if (width < 70 || height < 110) {
        continue;
      }

      if (height <= width) {
        continue;
      }

      // Main IMDb posters sit high in the hero area. Gallery photos are usually much lower.
      if (rect.top > 520) {
        continue;
      }

      score += 1000 - Math.max(0, rect.top);
      score += Math.min(height, 420);
      score += height > width * 1.25 ? 180 : 0;
      score += rect.left < window.innerWidth * 0.45 ? 160 : 0;

      if (score > bestScore) {
        bestScore = score;
        bestUrl = src;
      }
    }

    return bestUrl;
  }

  function extractFirstAmazonImage() {
    var images = document.querySelectorAll("img");
    var i;
    var src;

    for (i = 0; i < images.length; i += 1) {
      src = bestImageFromElement(images[i]);

      if (src && src.indexOf("m.media-amazon.com/images/M/") !== -1) {
        state.firstImageUrl = cleanImageUrl(src);
        return src;
      }
    }

    return "";
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
    var i;
    var src;

    for (i = 0; i < images.length; i += 1) {
      src = bestImageFromElement(images[i]);

      if (src && isLikelyPosterImage(images[i], src)) {
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
    var src = image.currentSrc || image.getAttribute("src") || image.getAttribute("data-src") || "";
    var candidates;
    var lastCandidate;
    var url;
    var srcsetUrl;

    if (srcset.indexOf("m.media-amazon.com/images/") !== -1) {
      candidates = srcset.split(",");
      lastCandidate = candidates[candidates.length - 1];
      srcsetUrl = lastCandidate ? lastCandidate.replace(/^\s+|\s+$/g, "").split(/\s+/)[0] : "";
      url = srcsetUrl || src;
    } else {
      url = src;
    }

    if (url && url.indexOf("m.media-amazon.com/images/") !== -1) {
      return url;
    }

    return "";
  }

  function isLikelyPosterImage(image, src) {
    var alt = (image.getAttribute("alt") || "").toLowerCase();
    var width = image.naturalWidth || image.width || 0;
    var height = image.naturalHeight || image.height || 0;

    if (src.indexOf("m.media-amazon.com/images/M/") === -1) {
      return false;
    }

    if (alt.indexOf("poster") !== -1 || alt.indexOf("primary image") !== -1) {
      return true;
    }

    if (height > width && height >= 250) {
      return true;
    }

    return false;
  }

  function extractFromPageHtml() {
    var html = document.documentElement.innerHTML;
    var matches = html.match(/https:\/\/m\.media-amazon\.com\/images\/M\/[^"'\\<>\s]+?\.(jpg|jpeg|png|webp)/gi);
    var i;

    if (!matches) {
      return "";
    }

    for (i = 0; i < matches.length; i += 1) {
      if (matches[i].indexOf("UY") !== -1 || matches[i].indexOf("UX") !== -1 || matches[i].indexOf("_V1_") !== -1) {
        return matches[i].replace(/\\u002F/g, "/");
      }
    }

    return matches[0].replace(/\\u002F/g, "/");
  }

  function cleanImageUrl(url) {
    if (!url) {
      return "";
    }

    return url.replace(/\._V1_[^./]+(?=\.(jpg|jpeg|png|webp))/i, "._V1_");
  }

  function setStatus(message) {
    var status = state.status;

    if (status) {
      status.textContent = message;
    }
  }

  function setButtons(enabled) {
    setButton("copy", enabled);
    setButton("open", enabled);
  }

  function setButton(action, enabled) {
    var button = state.panel ? state.panel.querySelector('button[data-action="' + action + '"]') : null;

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

  function useFirstImage() {
    var first = cleanImageUrl(extractFirstAmazonImage());

    if (!first) {
      setStatus("No first IMDb image found.");
      return;
    }

    state.posterUrl = first;
    setButtons(true);
    setStatus("Using first image: " + shortUrl(first));
  }

  function shortUrl(url) {
    if (!url) {
      return "";
    }

    return url.length > 42 ? url.slice(0, 39) + "..." : url;
  }

  function showDebugInfo() {
    var images = document.querySelectorAll("img");
    var metas = document.querySelectorAll('meta[property="og:image"],meta[name="twitter:image"]');
    var jsonScripts = document.querySelectorAll('script[type="application/ld+json"]');
    var firstImage = images[0] ? (images[0].currentSrc || images[0].src || images[0].getAttribute("src") || "") : "";

    window.prompt("Debug info:", ""
      + "URL: " + window.location.href + "\n"
      + "Images: " + images.length + "\n"
      + "Meta images: " + metas.length + "\n"
      + "JSON-LD blocks: " + jsonScripts.length + "\n"
      + "First image: " + firstImage + "\n"
      + "Current poster: " + state.posterUrl);
  }

  function showStartupError(error) {
    var panel = state.panel;

    if (panel) {
      setStatus("Startup error: " + error.message);
      return;
    }

    window.alert("IMDb Poster Helper startup error: " + error.message);
  }
}());
