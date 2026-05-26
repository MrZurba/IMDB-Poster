// ==UserScript==
// @name         IMDb Poster Helper
// @namespace    poster-extractor.local
// @version      1.1.1
// @description  Copy or open the poster image URL from IMDb title pages.
// @match        https://www.imdb.com/*
// @match        https://m.imdb.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @connect      imgbox.com
// @connect      m.media-amazon.com
// @connect      images-na.ssl-images-amazon.com
// @run-at       document-end
// ==/UserScript==

(function () {
  "use strict";

  var state = {
    posterUrl: "",
    firstImageUrl: "",
    attempts: 0,
    panel: null,
    status: null,
    output: null
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
      + '<div style="font-weight:bold;margin-bottom:8px;">IMDb Poster v1.1.1</div>'
      + '<button data-action="copy" disabled style="width:100%;margin-bottom:6px;padding:8px;border:0;border-radius:5px;background:#111;color:#f5c518;font-weight:bold;cursor:pointer;">Copy URL</button>'
      + '<button data-action="open" disabled style="width:100%;margin-bottom:6px;padding:8px;border:0;border-radius:5px;background:#111;color:#f5c518;font-weight:bold;cursor:pointer;">Open Poster</button>'
      + '<button data-action="upload" disabled style="width:100%;margin-bottom:6px;padding:8px;border:0;border-radius:5px;background:#111;color:#f5c518;font-weight:bold;cursor:pointer;">Upload Imgbox</button>'
      + '<button data-action="retry" style="width:100%;padding:8px;border:0;border-radius:5px;background:#fff;color:#111;font-weight:bold;cursor:pointer;">Retry</button>'
      + '<button data-action="debug" style="width:100%;margin-top:6px;padding:8px;border:0;border-radius:5px;background:#fff;color:#111;font-weight:bold;cursor:pointer;">Debug</button>'
      + '<textarea id="imdb-poster-helper-output" readonly style="display:none;width:100%;height:72px;margin-top:8px;padding:6px;box-sizing:border-box;border:2px solid #111;border-radius:5px;background:#fff;color:#111;font:11px Arial,sans-serif;resize:vertical;"></textarea>'
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
        refreshPosterSelection();
        window.open(state.posterUrl, "_blank", "noopener");
      }

      if (action === "retry") {
        state.attempts = 0;
        findPoster();
      }

      if (action === "upload") {
        uploadPosterUrl(event.target);
      }

      if (action === "debug") {
        showDebugInfo();
      }
    });

    document.body.appendChild(panel);
    state.panel = panel;
    state.status = panel.querySelector("#imdb-poster-helper-status");
    state.output = panel.querySelector("#imdb-poster-helper-output");
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

    if (src && src.indexOf("m.media-amazon.com/images/") !== -1) {
      return src;
    }

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
    setButton("upload", enabled);
  }

  function setButton(action, enabled) {
    var button = state.panel ? state.panel.querySelector('button[data-action="' + action + '"]') : null;

    if (button) {
      button.disabled = !enabled;
      button.style.opacity = enabled ? "1" : ".55";
    }
  }

  function copyPosterUrl() {
    refreshPosterSelection();
    setOutput(state.posterUrl);

    if (copyText(state.posterUrl)) {
      setStatus("Copied: " + shortUrl(state.posterUrl));
    } else {
      setStatus("Copy manually from the box below.");
    }
  }

  function showPromptFallback() {
    window.prompt("Copy poster URL:", state.posterUrl);
    setStatus("Copy manually from the popup.");
  }

  function refreshPosterSelection() {
    var posterUrl = extractPosterUrl();

    if (posterUrl) {
      state.posterUrl = posterUrl;
      setButtons(true);
    }
  }

  function uploadPosterUrl(button) {
    refreshPosterSelection();

    if (!state.posterUrl) {
      setStatus("No poster URL to upload.");
      return;
    }

    button.disabled = true;
    button.style.opacity = ".55";
    setStatus("Uploading to Imgbox...");

    uploadToImgbox(state.posterUrl, function (error, uploaded) {
      var uploadedUrl;

      button.disabled = false;
      button.style.opacity = "1";

      if (error) {
        setStatus("Upload failed: " + error.message);
        return;
      }

      uploadedUrl = uploaded.directUrl || uploaded.pageUrl;
      setOutput(uploadedUrl);

      if (copyText(uploadedUrl)) {
        setStatus("Uploaded and copied. Full URL is below.");
      } else {
        setStatus("Uploaded. Copy the full URL below.");
      }
    });
  }

  function uploadToImgbox(imageUrl, done) {
    getImgboxSession(function (sessionError, session) {
      if (sessionError) {
        done(sessionError);
        return;
      }

      getImgboxToken(session, function (tokenError, token) {
        if (tokenError) {
          done(tokenError);
          return;
        }

        getImageBlob(imageUrl, function (imageError, image) {
          if (imageError) {
            done(imageError);
            return;
          }

          uploadImageBlob(token, image, done);
        });
      });
    });
  }

  function getImgboxSession(done) {
    gmRequest({
      method: "GET",
      url: "https://imgbox.com/",
      responseType: "text"
    }, function (error, response) {
      var html;
      var match;

      if (error) {
        done(error);
        return;
      }

      html = response.responseText || "";
      match = html.match(/name=["']authenticity_token["'][^>]+value=["']([^"']+)["']/i)
        || html.match(/value=["']([^"']+)["'][^>]+name=["']authenticity_token["']/i)
        || html.match(/<meta[^>]+name=["']csrf-token["'][^>]+content=["']([^"']+)["']/i);

      if (!match || !match[1]) {
        done(new Error("Could not start Imgbox session."));
        return;
      }

      done(null, { csrfToken: decodeHtml(match[1]) });
    });
  }

  function getImgboxToken(session, done) {
    gmRequest({
      method: "POST",
      url: "https://imgbox.com/ajax/token/generate",
      headers: {
        Accept: "application/json, text/javascript, */*; q=0.01",
        Origin: "https://imgbox.com",
        Referer: "https://imgbox.com/",
        "X-CSRF-Token": session.csrfToken,
        "X-Requested-With": "XMLHttpRequest"
      },
      responseType: "json"
    }, function (error, response) {
      var token;

      if (error) {
        done(error);
        return;
      }

      token = getJsonResponse(response);

      if (!token || !token.token_id || !token.token_secret) {
        done(new Error("Could not create Imgbox upload token."));
        return;
      }

      done(null, token);
    });
  }

  function getImageBlob(imageUrl, done) {
    gmRequest({
      method: "GET",
      url: imageUrl,
      responseType: "blob"
    }, function (error, response) {
      var blob;
      var contentType;
      var extension;

      if (error) {
        done(error);
        return;
      }

      blob = response.response;
      contentType = blob && blob.type ? blob.type : "image/jpeg";
      extension = contentType.indexOf("png") !== -1 ? "png" : contentType.indexOf("webp") !== -1 ? "webp" : "jpg";

      done(null, {
        blob: blob,
        filename: "imdb-poster." + extension
      });
    });
  }

  function uploadImageBlob(token, image, done) {
    var form = new FormData();

    form.append("token_id", token.token_id);
    form.append("token_secret", token.token_secret);
    form.append("gallery_id", token.gallery_id || "null");
    form.append("gallery_secret", token.gallery_secret || "null");
    form.append("content_type", "1");
    form.append("thumbnail_size", "350c");
    form.append("comments_enabled", "0");
    form.append("files[]", image.blob, image.filename);

    gmRequest({
      method: "POST",
      url: "https://imgbox.com/upload/process",
      headers: {
        Accept: "application/json, text/javascript, */*; q=0.01",
        Origin: "https://imgbox.com",
        Referer: "https://imgbox.com/",
        "X-Requested-With": "XMLHttpRequest"
      },
      data: form,
      responseType: "json"
    }, function (error, response) {
      var payload;
      var file;

      if (error) {
        done(error);
        return;
      }

      payload = getJsonResponse(response);
      file = payload && payload.files && payload.files[0];

      if (!file) {
        done(new Error("Imgbox did not return an uploaded file."));
        return;
      }

      done(null, {
        pageUrl: absoluteImgboxUrl(file.url || file.page_url),
        directUrl: absoluteImgboxUrl(file.original_url || file.original || file.image_url)
      });
    });
  }

  function gmRequest(options, done) {
    options.onload = function (response) {
      if (response.status >= 200 && response.status < 300) {
        done(null, response);
        return;
      }

      done(new Error("HTTP " + response.status));
    };
    options.onerror = function () {
      done(new Error("Network request failed."));
    };
    options.ontimeout = function () {
      done(new Error("Network request timed out."));
    };

    GM_xmlhttpRequest(options);
  }

  function getJsonResponse(response) {
    if (response.response && typeof response.response === "object") {
      return response.response;
    }

    try {
      return JSON.parse(response.responseText || "");
    } catch (error) {
      return null;
    }
  }

  function absoluteImgboxUrl(url) {
    if (!url) {
      return "";
    }

    if (url.indexOf("//") === 0) {
      return "https:" + url;
    }

    if (url.indexOf("/") === 0) {
      return "https://imgbox.com" + url;
    }

    return url;
  }

  function copyText(text) {
    if (typeof GM_setClipboard === "function") {
      GM_setClipboard(text, "text");
      return true;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
      return true;
    }

    window.prompt("Copy URL:", text);
    return false;
  }

  function setOutput(url) {
    if (!state.output || !url) {
      return;
    }

    state.output.value = url;
    state.output.style.display = "block";
    state.output.focus();
    state.output.select();
  }

  function decodeHtml(value) {
    var textarea = document.createElement("textarea");
    textarea.innerHTML = value;
    return textarea.value;
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
