import express from "express";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

loadEnvFile();

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

app.post("/api/extract", async (req, res) => {
  try {
    const input = normalizeInput(req.body?.input);
    const imdbUrl = toImdbTitleUrl(input);
    const html = await fetchImdbHtml(imdbUrl);
    const poster = extractPoster(html);

    if (!poster?.url) {
      return res.status(404).json({
        error: "No poster image was found on that IMDb page."
      });
    }

    res.json({
      sourceUrl: imdbUrl,
      title: poster.title,
      posterUrl: poster.url,
      source: poster.source,
      uploaded: null
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.post("/api/upload", async (req, res) => {
  try {
    const imageUrl = normalizeUrl(req.body?.posterUrl);
    const result = await uploadToImgbox(imageUrl);

    res.json({
      url: result.originalUrl || result.url,
      displayUrl: result.url,
      thumbUrl: result.thumbnailUrl || null
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.post("/api/extract-and-upload", async (req, res) => {
  try {
    const input = normalizeInput(req.body?.input);
    const imdbUrl = toImdbTitleUrl(input);
    const html = await fetchImdbHtml(imdbUrl);
    const poster = extractPoster(html);

    if (!poster?.url) {
      return res.status(404).json({
        error: "No poster image was found on that IMDb page."
      });
    }

    const uploaded = await uploadToImgbox(poster.url);

    res.json({
      sourceUrl: imdbUrl,
      title: poster.title,
      posterUrl: poster.url,
      source: poster.source,
      uploaded: {
        url: uploaded.originalUrl || uploaded.url,
        displayUrl: uploaded.url,
        thumbUrl: uploaded.thumbnailUrl || null
      }
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Poster Extractor running at http://localhost:${port}`);
});

function loadEnvFile() {
  const envPath = resolve(".env");

  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);

    if (!match || process.env[match[1]] !== undefined) {
      continue;
    }

    process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

function normalizeInput(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw badRequest("Enter an IMDb title URL or ID.");
  }

  return value.trim();
}

function normalizeUrl(value) {
  if (typeof value !== "string") {
    throw badRequest("A poster URL is required.");
  }

  try {
    const url = new URL(value.trim());

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw badRequest("Only HTTP image URLs are supported.");
    }

    return url.toString();
  } catch {
    throw badRequest("Enter a valid poster URL.");
  }
}

function toImdbTitleUrl(input) {
  const idMatch = input.match(/tt\d{7,10}/i);

  if (!idMatch) {
    throw badRequest("Enter a valid IMDb title URL or ID like tt0111161.");
  }

  return `https://www.imdb.com/title/${idMatch[0]}/`;
}

async function fetchImdbHtml(url) {
  const response = await fetch(url, {
    headers: {
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
    }
  });

  if (!response.ok) {
    const error = new Error(`IMDb returned HTTP ${response.status}.`);
    error.status = response.status;
    throw error;
  }

  return response.text();
}

function extractPoster(html) {
  if (/window\.gokuProps|awsWafCookieDomainList/i.test(html)) {
    const error = new Error("IMDb returned a browser challenge. Use the bookmarklet on the IMDb page instead.");
    error.status = 409;
    throw error;
  }

  const jsonLd = getJsonLdPoster(html);

  if (jsonLd?.url) {
    return jsonLd;
  }

  const openGraph = getMetaPoster(html, "property", "og:image")
    || getMetaPoster(html, "name", "twitter:image");

  if (openGraph?.url) {
    return openGraph;
  }

  return null;
}

function getJsonLdPoster(html) {
  const scripts = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);

  for (const script of scripts) {
    const raw = decodeHtml(script[1].trim());

    try {
      const data = JSON.parse(raw);
      const movie = Array.isArray(data) ? data.find((item) => item?.image) : data;
      const image = Array.isArray(movie?.image) ? movie.image[0] : movie?.image;

      if (typeof image === "string") {
        return {
          url: cleanImdbImageUrl(image),
          title: typeof movie.name === "string" ? movie.name : null,
          source: "IMDb JSON-LD"
        };
      }
    } catch {
      continue;
    }
  }

  return null;
}

function getMetaPoster(html, attribute, name) {
  const pattern = new RegExp(`<meta[^>]+${attribute}=["']${escapeRegExp(name)}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
  const reversePattern = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attribute}=["']${escapeRegExp(name)}["'][^>]*>`, "i");
  const match = html.match(pattern) || html.match(reversePattern);

  if (!match?.[1]) {
    return null;
  }

  return {
    url: cleanImdbImageUrl(decodeHtml(match[1])),
    title: null,
    source: name
  };
}

function cleanImdbImageUrl(url) {
  return url.replace(/\._V1_[^./]+(?=\.(jpg|jpeg|png|webp))/i, "._V1_");
}

function decodeHtml(value) {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&#34;/g, "\"")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'");
}

async function uploadToImgbox(imageUrl) {
  const imageResponse = await fetch(imageUrl, {
    headers: {
      "accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
    }
  });

  if (!imageResponse.ok) {
    const error = new Error(`Could not download poster image. HTTP ${imageResponse.status}.`);
    error.status = imageResponse.status;
    throw error;
  }

  const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
  const contentLength = Number(imageResponse.headers.get("content-length") || 0);

  if (!contentType.startsWith("image/")) {
    throw badRequest("The poster URL did not return an image.");
  }

  if (contentLength > 10 * 1024 * 1024) {
    throw badRequest("Imgbox supports images up to 10MB.");
  }

  const imageBuffer = await imageResponse.arrayBuffer();

  if (imageBuffer.byteLength > 10 * 1024 * 1024) {
    throw badRequest("Imgbox supports images up to 10MB.");
  }

  const session = await getImgboxSession();
  const token = await getImgboxToken(session);
  const form = new FormData();
  const extension = contentType.includes("png") ? "png" : contentType.includes("gif") ? "gif" : "jpg";

  form.set("token_id", token.token_id);
  form.set("token_secret", token.token_secret);
  form.set("gallery_id", token.gallery_id || "null");
  form.set("gallery_secret", token.gallery_secret || "null");
  form.set("content_type", "1");
  form.set("thumbnail_size", "350c");
  form.set("comments_enabled", "0");
  form.set("files[]", new Blob([imageBuffer], { type: contentType }), `poster.${extension}`);

  const response = await fetch("https://imgbox.com/upload/process", {
    method: "POST",
    headers: {
      "accept": "application/json, text/javascript, */*; q=0.01",
      "cookie": session.cookie,
      "origin": "https://imgbox.com",
      "referer": "https://imgbox.com/",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      "x-requested-with": "XMLHttpRequest"
    },
    body: form,
    redirect: "manual"
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.files?.[0]) {
    const message = payload?.error || payload?.message || `Imgbox returned HTTP ${response.status}.`;
    const error = new Error(message);
    error.status = response.ok ? 502 : response.status;
    throw error;
  }

  return normalizeImgboxUpload(payload.files[0]);
}

async function getImgboxSession() {
  const response = await fetch("https://imgbox.com/", {
    headers: {
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
    }
  });
  const html = await response.text();
  const csrfToken = html.match(/name=["']authenticity_token["'][^>]+value=["']([^"']+)["']/i)?.[1]
    || html.match(/value=["']([^"']+)["'][^>]+name=["']authenticity_token["']/i)?.[1]
    || html.match(/<meta[^>]+name=["']csrf-token["'][^>]+content=["']([^"']+)["']/i)?.[1];
  const cookie = response.headers.getSetCookie?.().find((value) => value.startsWith("_imgbox_session="))
    || response.headers.get("set-cookie")?.split(",").find((value) => value.trim().startsWith("_imgbox_session="));

  if (!response.ok || !csrfToken || !cookie) {
    const error = new Error("Could not start an Imgbox upload session.");
    error.status = response.ok ? 502 : response.status;
    throw error;
  }

  return {
    csrfToken: decodeHtml(csrfToken),
    cookie: cookie.split(";")[0].trim()
  };
}

async function getImgboxToken(session) {
  const response = await fetch("https://imgbox.com/ajax/token/generate", {
    method: "POST",
    headers: {
      "accept": "application/json, text/javascript, */*; q=0.01",
      "cookie": session.cookie,
      "origin": "https://imgbox.com",
      "referer": "https://imgbox.com/",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      "x-csrf-token": session.csrfToken,
      "x-requested-with": "XMLHttpRequest"
    }
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.token_id || !payload?.token_secret) {
    const error = new Error("Could not create an Imgbox upload token.");
    error.status = response.ok ? 502 : response.status;
    throw error;
  }

  return payload;
}

function normalizeImgboxUpload(file) {
  return {
    url: absoluteImgboxUrl(file.url || file.image_url || file.page_url),
    originalUrl: absoluteImgboxUrl(file.original_url || file.original || file.url),
    thumbnailUrl: absoluteImgboxUrl(file.thumbnail_url || file.thumbnail)
  };
}

function absoluteImgboxUrl(url) {
  if (!url) {
    return null;
  }

  if (url.startsWith("//")) {
    return `https:${url}`;
  }

  if (url.startsWith("/")) {
    return `https://imgbox.com${url}`;
  }

  return url;
}

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
