# situate-extension

A Chrome extension that finds similar posts from the rationalsphere corpus (LessWrong + Substack) on [https://situate.info/rational](https://situate.info/rational) 
When you're on a post that's in the corpus, the toolbar icon fills in. Click it to see the most similar posts, or open the full search page on situate.info.

## Install

1. Clone this repo: git clone https://github.com/YOUR_USERNAME/situate.git
2. Open chrome://extensions in Chrome (or any Chromium browser).
3. Toggle Developer mode on (top right).
4. Click Load unpacked and select the cloned folder.

The Situate icon should appear in your toolbar. Pin it for easy access.
To update: git pull and click the refresh icon on the extension's card in chrome://extensions.

## How it works

- A small index of corpus URLs (FNV-1a 32-bit hashes) is fetched from situate.info on install and refreshed daily. Click the ↻ in the popup to refresh on demand.
- When you visit a LessWrong or Substack page, the extension canonicalizes the URL locally and checks the hash set.
- Clicking the icon sends the current URL to situate.info/rational/api/similar and shows the top 20 results.

## Privacy

- URLs are only sent to situate.info when you click the icon.
- Nothing about your browsing is stored or logged on your device beyond the cached hash index.
