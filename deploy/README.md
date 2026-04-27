# Deployment

This app is deployed as a Node.js service behind Nginx.

Nginx cannot serve the app alone because project persistence is handled by
Node.js APIs and SQLite.

## Build Package

```bash
npm run package
```

The deploy archive is written to:

```text
release/image-annotation-workshop.tar.gz
```

## Server Setup

The server needs Node.js 24 or newer because the app uses built-in
`node:sqlite`.

```bash
tar -xzf image-annotation-workshop.tar.gz
cd image-annotation-workshop
HOST=127.0.0.1 PORT=9092 node server.js
```

The deploy package includes `node_modules/`, so the server does not need to run
`npm install`.

For production, run the Node.js process with a process manager such as pm2 or
systemd.

## Nginx

Copy `deploy/nginx.conf.example` into your Nginx site config and update
`server_name`.

Nginx should expose port 80 or 443 publicly. Node.js should listen on
`127.0.0.1:9092` only.

The SQLite database is created at:

```text
data/projects.db
```

Back up the whole `data/` directory.
