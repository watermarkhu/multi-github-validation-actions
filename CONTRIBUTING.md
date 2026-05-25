# Contributing

## Development

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm run build      # writes dist/ for both actions
```

Both actions are bundled with esbuild (CJS, node20 target) to a single
`dist/index.js` per action. `dist/` is gitignored — the release workflow
builds and force-pushes the bundle onto the release tag, which is what
consumers reference.
