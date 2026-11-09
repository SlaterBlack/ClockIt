# ClockIt desktop launcher

This repository contains ClockIt’s independent Windows and Linux launcher. It packages and serves only the ClockIt frontend; StoreIt and PostgreSQL are managed by the StoreIt launcher.

## Development

Install this launcher’s dependencies and build the frontend from the repository root:

```bash
cd launcher
npm install
npm run build:sites
npm run dev
```

## Release

From `launcher/`, run `npm run release:windows`, `npm run release:linux`, or `npm run release:all`. The portable `.exe` and Linux AppImage are written under `launcher/release/`.

The launcher defaults to the shared StoreIt API at `127.0.0.1:4002` and serves ClockIt on `127.0.0.1:2400`. It saves settings in its own operating-system user-data directory. Email and password settings are not part of this launcher.

Choose `0.0.0.0` only when other devices on the LAN should access the frontend; the operating-system firewall may need to allow the selected port.
