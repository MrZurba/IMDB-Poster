// ==UserScript==
// @name         IMDb Poster to Imgbox
// @namespace    https://github.com/MrZurba/poster-extractor
// @version      1.0.2
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

  const state = {
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
    const poster = extractPoster();

    if (poster.url) {
      state.posterUrl = poster.url;
      state.title = poster.title || document.title.replace(/\s*-\s*IMDb\s*$/i, "");
    }
  }

  function extractPoster() {
    const jsonLdPoster = getJsonLdPoster();

    if (jsonLdPoster.url) {
      return jsonLdPoster;
    }

    const metaPoster = getMetaContent('meta[property="og:image"]')
      || getMetaContent('meta[name="twitter:image"]');

    return {
      url: cleanImdbImageUrl(metaPoster || ""),
      title: getMetaContent('meta[property="og:title"]') || ""
    };
  }

  function getJsonLdPoster() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');

    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent.trim());
        const item = Array.isArray(data) ? data.find((entry) => entry && entry.image) : data;
        const image = item && Array.isArray(item.image) ? item.image[0] : item && item.image;

        if (typeof image === "string") {
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

  function getMetaContent(selector) {
    const element = document.querySelector(selector);
    return element ? element.content : "";
  }

  function cleanImdbImageUrl(url) {
    return url.replace(/\._V1_[^./]+(?=\.(jpg|jpeg|png|webp))/i, "._V1_");
  }

  function renderPanel() {
    const panel = document.createElement("aside");
    panel.id = "imdb-poster-imgbox-panel";
    panel.innerHTML = `
      <div class="ipi-title">Poster</div>
      <button type="button" data-action="copy">Copy URL</button>
      <button type="button" data-action="upload">Upload Imgbox</button>
      <button type="button" data-action="open">Open</button>
      <button type="button" data-action="retry">Retry</button>
      <div class="ipi-status" role="status"></div>
    `;

    const style = document.createElement("style");
    style.textContent = `
      #imdb-poster-imgbox-panel {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 999999;
        display: grid;
        gap: 8px;
        width: 176px;
        border: 1px solid rgba(255,255,255,0.18);
        border-radius: 8px;
        background: #161616;
        box-shadow: 0 16px 46px rgba(0,0,0,0.45);
        color: #fff;
        font: 13px/1.35 Arial, sans-serif;
        padding: 12px;
      }
      #imdb-poster-imgbox-panel .ipi-title {
        font-weight: 800;
      }
      #imdb-poster-imgbox-panel button {
        min-height: 34px;
        border: 0;
        border-radius: 6px;
        background: #f5c518;
        color: #111;
        cursor: pointer;
        font: 700 13px/1 Arial, sans-serif;
      }
      #imdb-poster-imgbox-panel button:hover {
        background: #ddb00f;
      }
      #imdb-poster-imgbox-panel button:disabled {
        cursor: wait;
        opacity: 0.65;
      }
      #imdb-poster-imgbox-panel .ipi-status {
        min-height: 18px;
        color: #d7d7d7;
        overflow-wrap: anywhere;
      }
      #imdb-poster-imgbox-panel .ipi-status a {
        color: #f5c518;
      }
    `;

    document.documentElement.append(style, panel);

    panel.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action]");

      if (!button) {
        return;
      }

      const action = button.dataset.action;

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

        try {
          const uploaded = await uploadToImgbox(state.posterUrl);
          copyText(uploaded.directUrl || uploaded.pageUrl);
          setStatus(`Uploaded: <a href="${escapeAttribute(uploaded.pageUrl)}" target="_blank" rel="noopener">Imgbox</a>`);
        } catch (error) {
          setStatus(error.message || "Upload failed.");
        } finally {
          button.disabled = false;
        }
      }
    });
  }

  function setButtonsEnabled(enabled) {
    const buttons = document.querySelectorAll("#imdb-poster-imgbox-panel button[data-action]");

    for (const button of buttons) {
      if (button.dataset.action !== "retry") {
        button.disabled = !enabled;
      }
    }
  }

  async function uploadToImgbox(imageUrl) {
    const session = await getImgboxSession();
    const token = await getImgboxToken(session);
    const image = await getImageBlob(imageUrl);
    const form = new FormData();

    form.set("token_id", token.token_id);
    form.set("token_secret", token.token_secret);
    form.set("gallery_id", token.gallery_id || "null");
    form.set("gallery_secret", token.gallery_secret || "null");
    form.set("content_type", "1");
    form.set("thumbnail_size", "350c");
    form.set("comments_enabled", "0");
    form.append("files[]", image.blob, image.filename);

    const response = await gmRequest({
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
    });
    const file = response.response && response.response.files && response.response.files[0];

    if (!file) {
      throw new Error("Imgbox did not return an uploaded file.");
    }

    return {
      pageUrl: absoluteImgboxUrl(file.url || file.page_url),
      directUrl: absoluteImgboxUrl(file.original_url || file.original)
    };
  }

  async function getImgboxSession() {
    const response = await gmRequest({
      method: "GET",
      url: "https://imgbox.com/",
      responseType: "text"
    });
    const html = response.responseText || "";
    const tokenMatch = html.match(/name=["']authenticity_token["'][^>]+value=["']([^"']+)["']/i)
      || html.match(/value=["']([^"']+)["'][^>]+name=["']authenticity_token["']/i)
      || html.match(/<meta[^>]+name=["']csrf-token["'][^>]+content=["']([^"']+)["']/i);
    const csrfToken = tokenMatch && tokenMatch[1];

    if (!csrfToken) {
      throw new Error("Could not start an Imgbox session.");
    }

    return { csrfToken: decodeHtml(csrfToken) };
  }

  async function getImgboxToken(session) {
    const response = await gmRequest({
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
    });
    const token = response.response;

    if (!token || !token.token_id || !token.token_secret) {
      throw new Error("Could not create an Imgbox upload token.");
    }

    return token;
  }

  async function getImageBlob(imageUrl) {
    const response = await gmRequest({
      method: "GET",
      url: imageUrl,
      responseType: "blob"
    });
    const contentType = response.response && response.response.type ? response.response.type : "image/jpeg";
    const extension = contentType.includes("png") ? "png" : contentType.includes("gif") ? "gif" : "jpg";

    return {
      blob: response.response,
      filename: filenameFromTitle(state.title, extension)
    };
  }

  function gmRequest(options) {
    return new Promise((resolve, reject) => {
      const requestOptions = Object.assign({}, options, {
        onload: (response) => {
          if (response.status >= 200 && response.status < 300) {
            resolve(response);
            return;
          }

          reject(new Error(`Request failed with HTTP ${response.status}.`));
        },
        onerror: () => reject(new Error("Network request failed.")),
        ontimeout: () => reject(new Error("Network request timed out."))
      });

      GM_xmlhttpRequest(requestOptions);
    });
  }

  function filenameFromTitle(title, extension) {
    const cleanTitle = (title || "imdb-poster")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);

    return `${cleanTitle || "imdb-poster"}.${extension}`;
  }

  function absoluteImgboxUrl(url) {
    if (!url) {
      return "";
    }

    if (url.startsWith("//")) {
      return `https:${url}`;
    }

    if (url.startsWith("/")) {
      return `https://imgbox.com${url}`;
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
    const status = document.querySelector("#imdb-poster-imgbox-panel .ipi-status");

    if (status) {
      status.innerHTML = message;
    }
  }

  function decodeHtml(value) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = value;
    return textarea.value;
  }

  function escapeAttribute(value) {
    return value.replace(/"/g, "&quot;");
  }
})();
