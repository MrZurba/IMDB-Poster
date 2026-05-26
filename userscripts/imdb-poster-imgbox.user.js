// ==UserScript==
// @name         IMDb Poster to Imgbox
// @namespace    poster-extractor.local
// @version      1.0.4
// @description  Extract IMDb poster URLs and optionally upload them to Imgbox.
// @author       MrZurba
// @match        https://www.imdb.com/title/tt*
// @match        https://m.imdb.com/title/tt*
// @match        https://imdb.com/title/tt*
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @connect      imgbox.com
// @connect      m.media-amazon.com
// @connect      images-na.ssl-images-amazon.com
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  var state = {
    posterUrl: "",
    title: "",
    attempts: 0
  };

  init();

  function init() {
    renderPanel();
    findPosterWithRetry();
  }

  function findPosterWithRetry() {
    updatePosterState();

    if (state.posterUrl) {
      setStatus("Poster found.");
      setButtonsEnabled(true);
      return;
    }

    state.attempts += 1;
    setStatus("Looking for poster...");
    setButtonsEnabled(false);

    if (state.attempts < 12) {
      window.setTimeout(findPosterWithRetry, 750);
      return;
    }

    setStatus("No poster found. Try Retry after the page finishes loading.");
    setButtonsEnabled(false);
  }

  function updatePosterState() {
    var poster = extractPoster();

    if (poster.url) {
      state.posterUrl = poster.url;
      state.title = poster.title || document.title.replace(/\s*-\s*IMDb\s*$/i, "");
    }
  }

  function extractPoster() {
    var jsonLdPoster = getJsonLdPoster();
    var metaPoster;

    if (jsonLdPoster.url) {
      return jsonLdPoster;
    }

    metaPoster = getMetaContent('meta[property="og:image"]') || getMetaContent('meta[name="twitter:image"]');

    return {
      url: cleanImdbImageUrl(metaPoster || ""),
      title: getMetaContent('meta[property="og:title"]') || ""
    };
  }

  function getJsonLdPoster() {
    var scripts = document.querySelectorAll('script[type="application/ld+json"]');
    var i;

    for (i = 0; i < scripts.length; i += 1) {
      try {
        var data = JSON.parse(scripts[i].textContent.trim());
        var item = findImageItem(data);
        var image = "";

        if (item && item.image) {
          image = Array.isArray(item.image) ? item.image[0] : item.image;
        }

        if (typeof image === "string" && image) {
          return {
            url: cleanImdbImageUrl(image),
            title: typeof item.name === "string" ? item.name : ""
          };
        }
      } catch (error) {
        continue;
      }
    }

    return { url: "", title: "" };
  }

  function findImageItem(data) {
    var i;

    if (!Array.isArray(data)) {
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
    return element ? element.content : "";
  }

  function cleanImdbImageUrl(url) {
    return url.replace(/\._V1_[^./]+(?=\.(jpg|jpeg|png|webp))/i, "._V1_");
  }

  function renderPanel() {
    var panel = document.createElement("aside");
    var style = document.createElement("style");

    panel.id = "imdb-poster-imgbox-panel";
    panel.innerHTML = ""
      + '<div class="ipi-title">Poster</div>'
      + '<button type="button" data-action="copy">Copy URL</button>'
      + '<button type="button" data-action="upload">Upload Imgbox</button>'
      + '<button type="button" data-action="open">Open</button>'
      + '<button type="button" data-action="retry">Retry</button>'
      + '<div class="ipi-status" role="status"></div>';

    style.textContent = ""
      + "#imdb-poster-imgbox-panel{position:fixed;right:18px;bottom:18px;z-index:2147483647;display:grid;gap:8px;width:176px;border:1px solid rgba(255,255,255,.18);border-radius:8px;background:#161616;box-shadow:0 16px 46px rgba(0,0,0,.45);color:#fff;font:13px/1.35 Arial,sans-serif;padding:12px;}"
      + "#imdb-poster-imgbox-panel .ipi-title{font-weight:800;}"
      + "#imdb-poster-imgbox-panel button{min-height:34px;border:0;border-radius:6px;background:#f5c518;color:#111;cursor:pointer;font:700 13px/1 Arial,sans-serif;}"
      + "#imdb-poster-imgbox-panel button:hover{background:#ddb00f;}"
      + "#imdb-poster-imgbox-panel button:disabled{cursor:wait;opacity:.65;}"
      + "#imdb-poster-imgbox-panel .ipi-status{min-height:18px;color:#d7d7d7;overflow-wrap:anywhere;}"
      + "#imdb-poster-imgbox-panel .ipi-status a{color:#f5c518;}";

    document.documentElement.appendChild(style);
    document.documentElement.appendChild(panel);

    panel.addEventListener("click", function (event) {
      var button = closestButton(event.target);
      var action;

      if (!button) {
        return;
      }

      action = button.getAttribute("data-action");

      if (action === "retry") {
        state.attempts = 0;
        findPosterWithRetry();
      }

      if (action === "copy") {
        copyText(state.posterUrl);
        setStatus("Copied original URL.");
      }

      if (action === "open") {
        window.open(state.posterUrl, "_blank", "noopener");
      }

      if (action === "upload") {
        button.disabled = true;
        setStatus("Uploading...");
        uploadToImgbox(state.posterUrl, function (error, uploaded) {
          button.disabled = false;

          if (error) {
            setStatus(error.message || "Upload failed.");
            return;
          }

          copyText(uploaded.directUrl || uploaded.pageUrl);
          setStatus('Uploaded: <a href="' + escapeAttribute(uploaded.pageUrl) + '" target="_blank" rel="noopener">Imgbox</a>');
        });
      }
    });
  }

  function closestButton(element) {
    while (element && element !== document) {
      if (element.tagName && element.tagName.toLowerCase() === "button" && element.getAttribute("data-action")) {
        return element;
      }

      element = element.parentNode;
    }

    return null;
  }

  function setButtonsEnabled(enabled) {
    var buttons = document.querySelectorAll("#imdb-poster-imgbox-panel button[data-action]");
    var i;

    for (i = 0; i < buttons.length; i += 1) {
      if (buttons[i].getAttribute("data-action") !== "retry") {
        buttons[i].disabled = !enabled;
      }
    }
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
          var form;

          if (imageError) {
            done(imageError);
            return;
          }

          form = new FormData();
          form.set("token_id", token.token_id);
          form.set("token_secret", token.token_secret);
          form.set("gallery_id", token.gallery_id || "null");
          form.set("gallery_secret", token.gallery_secret || "null");
          form.set("content_type", "1");
          form.set("thumbnail_size", "350c");
          form.set("comments_enabled", "0");
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
          }, function (uploadError, response) {
            var file;

            if (uploadError) {
              done(uploadError);
              return;
            }

            file = response.response && response.response.files && response.response.files[0];

            if (!file) {
              done(new Error("Imgbox did not return an uploaded file."));
              return;
            }

            done(null, {
              pageUrl: absoluteImgboxUrl(file.url || file.page_url),
              directUrl: absoluteImgboxUrl(file.original_url || file.original)
            });
          });
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
      var tokenMatch;
      var csrfToken;

      if (error) {
        done(error);
        return;
      }

      html = response.responseText || "";
      tokenMatch = html.match(/name=["']authenticity_token["'][^>]+value=["']([^"']+)["']/i)
        || html.match(/value=["']([^"']+)["'][^>]+name=["']authenticity_token["']/i)
        || html.match(/<meta[^>]+name=["']csrf-token["'][^>]+content=["']([^"']+)["']/i);
      csrfToken = tokenMatch && tokenMatch[1];

      if (!csrfToken) {
        done(new Error("Could not start an Imgbox session."));
        return;
      }

      done(null, { csrfToken: decodeHtml(csrfToken) });
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

      token = response.response;

      if (!token || !token.token_id || !token.token_secret) {
        done(new Error("Could not create an Imgbox upload token."));
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
      var contentType;
      var extension;

      if (error) {
        done(error);
        return;
      }

      contentType = response.response && response.response.type ? response.response.type : "image/jpeg";
      extension = contentType.indexOf("png") !== -1 ? "png" : contentType.indexOf("gif") !== -1 ? "gif" : "jpg";

      done(null, {
        blob: response.response,
        filename: filenameFromTitle(state.title, extension)
      });
    });
  }

  function gmRequest(options, done) {
    options.onload = function (response) {
      if (response.status >= 200 && response.status < 300) {
        done(null, response);
        return;
      }

      done(new Error("Request failed with HTTP " + response.status + "."));
    };
    options.onerror = function () {
      done(new Error("Network request failed."));
    };
    options.ontimeout = function () {
      done(new Error("Network request timed out."));
    };

    GM_xmlhttpRequest(options);
  }

  function filenameFromTitle(title, extension) {
    var cleanTitle = (title || "imdb-poster")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);

    return (cleanTitle || "imdb-poster") + "." + extension;
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
      return;
    }

    navigator.clipboard.writeText(text);
  }

  function setStatus(message) {
    var status = document.querySelector("#imdb-poster-imgbox-panel .ipi-status");

    if (status) {
      status.innerHTML = message;
    }
  }

  function decodeHtml(value) {
    var textarea = document.createElement("textarea");
    textarea.innerHTML = value;
    return textarea.value;
  }

  function escapeAttribute(value) {
    return value.replace(/"/g, "&quot;");
  }
}());
