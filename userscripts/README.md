# IMDb Poster to Imgbox Userscript

This is the simplest way to use the tool without hosting a public backend.

## Install

1. Install Tampermonkey or Violentmonkey in your browser.
2. Open `imdb-poster-imgbox.user.js`.
3. Create a new userscript and paste the file contents.
4. Save it.
5. Make sure the userscript is enabled.

## Use

1. Open an IMDb title page such as `https://www.imdb.com/title/tt0111161/`.
2. Use the small **Poster** panel at the bottom-right.
3. Click **Copy URL** for the direct IMDb poster URL.
4. Click **Upload Imgbox** to upload it to Imgbox and copy the hosted URL.

The script runs on IMDb pages only. Imgbox upload uses the same guest upload flow as the Imgbox website, so it does not need an API key.

If the panel does not appear, open an IMDb title page like `https://www.imdb.com/title/tt0111161/`, click the Violentmonkey/Tampermonkey extension icon, and confirm this script is listed as running on the page. Version `1.0.3` shows the panel even while it is still looking for the poster and uses conservative JavaScript syntax for userscript parser compatibility.
