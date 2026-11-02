# Decisif Shelf 1.0.1

**English** · [简体中文](README.zh-CN.md)

A minimal, key-unlocked file shelf hosted on GitHub Pages. The website lives in this repository; uploaded files live in a separate private GitHub repository.

[Open Shelf](https://studio-decisif.github.io/decisif-shelf/)

## What's new in 1.0.1

- Files sort by upload time, newest first. File sizes use decimal KB / MB / GB.
- Click or tap anywhere in a file row to select it, then use the download arrow. Mouse double-click downloads; touch double-taps do not. Upload, download and theme icons have larger invisible touch targets.
- Refresh restoration keeps the session and cached list through temporary network failures. Invalid credentials, changed encrypted configuration or damaged session data can still require unlocking again.
- Modern sans-serif invitation text matches the table labels, with faster character reveal. Upload feedback, button availability, focus rings, panel entry and exit use smooth transitions. Existing files keep their normal color during uploads.
- The success check pauses for 300ms. Login corners are aligned with the input and Confirm controls. The panel appears in place by clearing its own blur, without sliding or scaling. Background blur animates its actual radius: up to 6px on desktop or 4px on narrow screens.
- Theme switching has hover/press feedback and gradual palette transitions. An unavailable or unknown system color preference defaults to dark. Dark login panels have no glow or shadow.
- Mobile layouts prevent horizontal page scrolling while preserving vertical scrolling and pinch zoom.

## Run locally

Use Node.js 22 or newer. From the project directory:

```sh
npm run preview
```

Open http://127.0.0.1:8765/ and keep the preview process running. This address is local to your computer; share the Pages URL instead. Run `npm test` for automated checks.

## Use

Click **key**, enter your passphrase and choose **Confirm**. Successful local decryption draws a check before GitHub requests finish. The welcome title is `decisif shelf`; its current cycle finishes before closing. Welcome audio plays once per explicit login.

Click **+** to choose files. New rows fade in with a spinner. Once GitHub confirms the commit, a small green check and success sound provide feedback. Select a row and use the download arrow. File contents are fetched only when downloaded; Office files open in your local applications after download. **Created** means the time a file was added through Shelf, not its original filesystem creation time. Files without recorded timestamps show `—` and sort last.

Refreshing restores the session and displays cached directory metadata while checking GitHub. Temporary request failures show `error` without discarding the session. Opening **key** preserves the current list and login; clicking outside or pressing Escape dismisses it. This input does not change the configured passphrase.

The half-black/half-white circle switches themes. The initial theme follows the browser/system where available; a manual selection is remembered separately from authentication.

## Configure private storage

Create a fine-grained GitHub PAT restricted to the **private data repository**, with Contents read/write. In a local interactive terminal, run:

```sh
node scripts/setup-vault.mjs
```

Accept or enter the owner, repository and branch. Enter the PAT and a random passphrase of at least 12 characters when prompted; secret input is hidden. The tool checks private repository access and generates `docs/config/vault.json`. Commit this encrypted configuration with the website. Re-running the tool replaces it. Do not add plaintext credentials to the repository or send them in chat.

For local demonstration only:

```sh
node scripts/setup-vault.mjs --demo
```

This replaces the real configuration with an in-memory demo using `ShelfDemo123`. Demo uploads disappear on refresh. Only run it if you intend to replace your current configuration.

## Storage and security model

- Website: `docs/` in `STUDIO-decisif/decisif-shelf`. Pages source: `main` → `/docs`.
- Data: `storage/<filename>` in the separate private `decisif-shelf-storage` repository. `.shelf/files.json` records creation times. An upload batch commits files and metadata together, with non-force branch updates and conflict retries.
- Limits: 25 MiB per file (26,214,400 bytes), 200 files per batch and 100 MiB per batch. These limits are byte-based; the list displays decimal units. Flat storage; existing filenames are not overwritten.
- Encryption: PBKDF2-HMAC-SHA256 with 600,000 iterations, AES-256-GCM, random 16-byte salt, random 12-byte IV, 128-bit authentication tag and authenticated configuration parameters.
- The passphrase and derived encryption key are not persisted. The decrypted PAT, encrypted configuration identity and cached directory metadata use `sessionStorage` so refreshes can restore login. The app does not cache file bodies. Theme preference alone uses `localStorage`.
- Normal tab/browser closure usually ends the session. Browser tab/session restoration can preserve it. The app cannot guarantee zero disk traces or mandatory logout after browser restart.
- This is a shared-secret design for trusted users, not individual accounts. A key holder can extract the PAT and use its complete GitHub permissions, including API deletion. Revoke the old PAT and replace the encrypted configuration to revoke access. Public ciphertext permits offline guessing; use a random passphrase. Stored documents are private repository contents, not end-to-end encrypted.
- Interrupted uploads may leave unreferenced blobs. After an uncertain network result, inspect the list before retrying.

## Versions

- [v0.1](https://github.com/STUDIO-decisif/decisif-shelf/tree/v0.1): original file browser with manual repository connection.
- [v1.0](https://github.com/STUDIO-decisif/decisif-shelf/tree/v1.0): encrypted key configuration, private storage, session restoration, English UI, welcome/upload motion and themes.
- [v1.0.1](https://github.com/STUDIO-decisif/decisif-shelf/tree/v1.0.1): interaction polish, mobile touch targets, session resilience, newest-first ordering and decimal size display.

## Validation

Automated checks cover binary requests, encryption interoperability and tampering, conflicts and failed commits, refresh restoration including transient failures, touch versus mouse interaction, ordering, theme fallback, animation sequencing and audible WAV data. A real private-repository upload was confirmed by the owner. Browser previews checked layout widths, themes, hover, cancellation and blur; perceived motion, sound and performance still depend on the actual device.

References: [WebCrypto deriveKey](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey), [GitHub Git references](https://docs.github.com/en/rest/git/refs).
