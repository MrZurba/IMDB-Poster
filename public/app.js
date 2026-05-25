const form = document.querySelector("#poster-form");
const input = document.querySelector("#imdb-input");
const uploadCheck = document.querySelector("#upload-check");
const status = document.querySelector("#status");
const result = document.querySelector("#result");
const posterPreview = document.querySelector("#poster-preview");
const movieTitle = document.querySelector("#movie-title");
const source = document.querySelector("#source");
const posterUrl = document.querySelector("#poster-url");
const uploadedUrl = document.querySelector("#uploaded-url");
const uploadResult = document.querySelector("#upload-result");
const copyPoster = document.querySelector("#copy-poster");
const copyUploaded = document.querySelector("#copy-uploaded");
const uploadCurrent = document.querySelector("#upload-current");
const bookmarkletLink = document.querySelector("#bookmarklet-link");

setupBookmarklet();
loadFromQueryString();

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const endpoint = uploadCheck.checked ? "/api/extract-and-upload" : "/api/extract";
  const button = form.querySelector("button");

  setStatus(uploadCheck.checked ? "Extracting and uploading..." : "Extracting poster...");
  button.disabled = true;
  result.hidden = true;
  uploadResult.hidden = true;

  try {
    const data = await postJson(endpoint, { input: input.value });
    showResult(data);
    setStatus("Ready.");
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    button.disabled = false;
  }
});

copyPoster.addEventListener("click", () => copyValue(posterUrl, copyPoster));
copyUploaded.addEventListener("click", () => copyValue(uploadedUrl, copyUploaded));
uploadCurrent.addEventListener("click", uploadCurrentPoster);

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong.");
  }

  return data;
}

function showResult(data) {
  posterPreview.src = data.posterUrl;
  posterPreview.alt = data.title ? `${data.title} poster` : "IMDb poster";
  movieTitle.textContent = data.title || "Poster found";
  source.textContent = `Extracted from ${data.source}.`;
  posterUrl.value = data.posterUrl;

  if (data.uploaded?.url) {
    uploadedUrl.value = data.uploaded.url;
    uploadResult.hidden = false;
  }

  result.hidden = false;
}

async function uploadCurrentPoster() {
  uploadCurrent.disabled = true;
  uploadResult.hidden = true;
  setStatus("Uploading to Imgbox...");

  try {
    const data = await postJson("/api/upload", { posterUrl: posterUrl.value });
    uploadedUrl.value = data.url;
    uploadResult.hidden = false;
    setStatus("Uploaded.");
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    uploadCurrent.disabled = false;
  }
}

function loadFromQueryString() {
  const params = new URLSearchParams(window.location.search);
  const url = params.get("poster");

  if (!url) {
    return;
  }

  showResult({
    title: params.get("title"),
    posterUrl: url,
    source: params.get("source") || "IMDb page metadata",
    uploaded: null
  });
  setStatus("Poster captured from the IMDb page.");
}

function setupBookmarklet() {
  const appUrl = window.location.origin + window.location.pathname;
  const code = `(() => {
    const clean = (url) => url ? url.replace(/\\._V1_[^./]+(?=\\.(jpg|jpeg|png|webp))/i, "._V1_") : "";
    const meta = (selector) => document.querySelector(selector)?.content || "";
    let poster = "";
    let title = "";
    const scripts = [...document.querySelectorAll('script[type="application/ld+json"]')];

    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        const item = Array.isArray(data) ? data.find((entry) => entry && entry.image) : data;
        const image = Array.isArray(item?.image) ? item.image[0] : item?.image;

        if (image) {
          poster = image;
          title = item?.name || "";
          break;
        }
      } catch {}
    }

    poster = poster || meta('meta[property="og:image"]') || meta('meta[name="twitter:image"]');
    title = title || meta('meta[property="og:title"]') || document.title.replace(/ - IMDb$/, "");

    if (!poster) {
      alert("No poster image was found on this IMDb page.");
      return;
    }

    const target = new URL(${JSON.stringify(appUrl)});
    target.searchParams.set("poster", clean(poster));
    target.searchParams.set("title", title);
    target.searchParams.set("source", "IMDb browser page");
    window.open(target.toString(), "_blank", "noopener");
  })();`;

  bookmarkletLink.href = `javascript:${encodeURIComponent(code)}`;
}

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("error", isError);
}

async function copyValue(field, button) {
  await navigator.clipboard.writeText(field.value);
  const previous = button.textContent;
  button.textContent = "Copied";
  window.setTimeout(() => {
    button.textContent = previous;
  }, 1100);
}
