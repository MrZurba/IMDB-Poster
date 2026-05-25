# IMDb Poster to Imgbox Userscript

This is the simplest way to use the tool without hosting a public backend.

## Install

1. Install Tampermonkey or Violentmonkey in your browser.
2. Open `imdb-poster-imgbox.user.js`.
3. Create a new userscript and paste the file contents.
4. Save it.

## Use

1. Open an IMDb title page such as `https://www.imdb.com/title/tt0111161/`.
2. Use the small **Poster** panel at the bottom-right.
3. Click **Copy URL** for the direct IMDb poster URL.
4. Click **Upload Imgbox** to upload it to Imgbox and copy the hosted URL.

The script runs on IMDb pages only. Imgbox upload uses the same guest upload flow as the Imgbox website, so it does not need an API key.
