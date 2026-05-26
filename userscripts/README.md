# IMDb Poster Helper Userscript

This is the simplest way to use the tool without hosting a public backend.

## Install

1. Install Tampermonkey or Violentmonkey in your browser.
2. Open `imdb-poster-helper.user.js`.
3. Install or update the userscript.
4. Make sure the userscript is enabled.

## Use

1. Open an IMDb title page such as `https://www.imdb.com/title/tt0111161/`.
2. Use the small **IMDb Poster** panel at the bottom-right.
3. Click **Copy URL** for the direct IMDb poster URL.
4. Click **Open Poster** to open the original poster image in a new tab.
5. Click **Upload Imgbox** to upload the poster to Imgbox and copy the hosted URL.

Version `1.1.0` includes Imgbox upload. It does not need an API key.

If the panel does not appear, open an IMDb title page like `https://www.imdb.com/title/tt0111161/`, click the Violentmonkey/Tampermonkey extension icon, and confirm this script is listed as running on the page.
