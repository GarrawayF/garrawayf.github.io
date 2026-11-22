# Shinagawa GitHub Pages frontend

This subtree contains the public frontend source for the event entrance and board. Real posts, participant-only cover HTML, schedule, guide PDF, source-deck metadata and slide previews remain in the protected API. There are no passwords, session tokens, private slide images or original deck IDs in this tree.

## Rebuild (Node.js 22+)

From the published meetup directory:

```sh
cd _source
npm ci
npm run build -- \
  --out /tmp/shinagawa-pages-next \
  --assets ../board/assets
```

Use a new empty output directory. The asset input is only used for an explicit allow-list (favicon, QR icons, generic drawing references in scene-photos); even if a legacy checkout still has a slide directory it is not copied. The output is:

- `index.html`: public authorization shell for the event cover
- `access.js`: proof check and narrowly scoped authenticated requests
- `board/index.html`: public authorization shell for the board
- `board/assets/`: board JS, CSS and the allow-listed artwork

Deploy output under the existing meetup path, preserving paths. Install the matching backend routes before cutover (`/api/access`, `/api/cover`, `/api/materials`, `/api/asset/slides/...`, `/api/guide`, and existing ideas/themes/comments/reactions). The native protected service is deployed separately and is not modified by this build. Do not use the generic `export-html.mjs` directly to publish the Pages entrypoint: it writes an ungated HTML shell.
