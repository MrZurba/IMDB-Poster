# IMDb Poster Extractor

A small public-friendly web tool for extracting a poster image URL from an IMDb title page. The main flow is a bookmarklet that runs on the IMDb page in the user's browser, reads page metadata such as JSON-LD and Open Graph tags, then opens the tool with the poster URL.

There is also a server fallback for IMDb URLs, but IMDb may return a browser challenge to server requests. When that happens, use the bookmarklet flow.

Automatic reupload is supported through Imgbox. It does not need an API key.

## Recommended: userscript

The easiest public version is the Tampermonkey/Violentmonkey userscript:

[userscripts/imdb-poster-helper.user.js](userscripts/imdb-poster-helper.user.js)

It runs directly on IMDb title pages, adds a small **IMDb Poster** panel, copies the IMDb poster URL, and can upload to Imgbox without needing your own hosted backend.

See [userscripts/README.md](userscripts/README.md) for install steps.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Browser bookmarklet flow

1. Open the app.
2. Drag **Grab IMDb Poster** to your browser bookmarks bar.
3. Open an IMDb title page.
4. Click the bookmarklet.
5. The tool opens with the poster URL ready to copy or upload.

## Imgbox upload

The checkbox for automatic reupload calls the server route, which downloads the extracted poster and uploads it to Imgbox as a guest upload.

For a public deployment, protect the upload route with rate limiting, CAPTCHA, or your own access control so strangers cannot abuse your server as an open uploader.

## API

`POST /api/extract`

```json
{
  "input": "https://www.imdb.com/title/tt0111161/"
}
```

`POST /api/extract-and-upload`

```json
{
  "input": "tt0111161"
}
```

`POST /api/upload`

```json
{
  "posterUrl": "https://m.media-amazon.com/images/..."
}
```
