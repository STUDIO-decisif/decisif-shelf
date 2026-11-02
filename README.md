# Decisif Shelf 1.0

A minimal, key-unlocked file shelf hosted on GitHub Pages. Website code lives in this repository; files live in the separate private `decisif-shelf-storage` repository.

## Versions

- **0.1**: original working file browser and manual repository connection.
- **1.0**: encrypted key configuration, private storage, session restoration, minimal English UI, upload feedback, welcome motion, and light/dark themes.

## Run locally

Use Node.js 22 or newer:

```sh
npm run preview
```

Open http://127.0.0.1:8765/ and keep the preview process running. Use `npm test` for automated checks.

## Use

Click **key**, enter the configured passphrase, and confirm. A local successful decryption draws a check before GitHub loads. The welcome text is `decisif shelf`; its current cycle always completes before closing. Welcome audio plays once per explicit login.

Click **+** to upload. Only new rows fade in with a spinner, then draw a green check and play a sound after GitHub confirms the commit. Existing rows retain their normal color. Select a file and use the download arrow, or double-click its name. File contents are fetched only when downloaded. Created means the time the file was added through Shelf.

Refreshing restores the current session and immediately displays the last cached directory while checking GitHub. The key button opens the input over the existing list; clicking outside or pressing Escape dismisses it without changing the existing login. It does not change the configured key.

Theme follows the browser/system until manually changed using the half-black/half-white circle. Manual theme preference is stored separately from authentication.

## Configure a private repository

The published config is encrypted. Do not add plaintext credentials to the repository or send them in chat.

Create a fine-grained GitHub PAT restricted to the **private data repository**, with Contents read/write, and run this in a local interactive terminal:

```sh
node scripts/setup-vault.mjs
```

Accept or enter the owner, repository, and branch. Enter the PAT and a random passphrase of at least 12 characters when prompted; secret input is hidden. The tool checks private repository access and generates `docs/config/vault.json`. Commit that encrypted file along with the website. Re-running the tool replaces the configuration.

For local demonstration only, `node scripts/setup-vault.mjs --demo` replaces the real configuration with an in-memory demo using key `ShelfDemo123`. Do not run this on your production config unless intended. Demo uploads disappear on refresh.

## Storage and security model

- Website: `docs/` in `STUDIO-decisif/decisif-shelf`; Pages source is `main` → `/docs`.
- Data: `storage/<filename>` in the separate private repository. `.shelf/files.json` records creation times. Both are published in one commit per upload batch with a non-force reference update and conflict retries.
- Limits: 25 MiB/file, 200 files/batch, 100 MiB/batch. Flat file list; existing names are not overwritten. Office files download as original bytes for local applications.
- PBKDF2-HMAC-SHA256, 600,000 iterations; AES-256-GCM; random 16-byte salt, 12-byte IV, 128-bit authentication tag, and authenticated repository/configuration parameters.
- The passphrase and derived encryption key are not persisted. The decrypted PAT, encrypted configuration identity, and cached directory metadata are kept in `sessionStorage` for refresh restoration. No file bodies are cached by the application. Theme preference alone uses `localStorage`.
- Normal tab/browser closure usually ends session storage. Browser session/tab restoration can preserve it; the app cannot guarantee zero disk traces or mandatory logout after browser restart.
- This is a shared-secret design for trusted users, not individual accounts. Anyone with the key can extract the PAT and exercise its complete GitHub permissions, including deletion through the API. Revoke the old PAT and replace the encrypted config to revoke access. Public ciphertext allows offline guessing; use a random key. Uploaded documents are private repository contents, not end-to-end encrypted.
- Failed uploads may leave unreferenced blobs. After a network interruption, inspect the list before retrying. Older files lacking metadata show `—` for creation time.

## Validation

Automated tests cover GitHub requests/binary data, encryption interoperability/tampering, conflicts and failed commits, session restoration, animation ordering, invitation hover, and audible WAV validation. The owner confirmed a real upload in the private data repository. Browser previews checked themes, welcome motion, cancellation, and hover interactions; final audio perception and older-computer performance depend on the actual device.

References: [WebCrypto deriveKey](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey), [GitHub Git references](https://docs.github.com/en/rest/git/refs).
