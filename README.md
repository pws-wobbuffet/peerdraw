# peerdraw

**Real-time collaborative drawing. No server. No account. Just draw.**

Open the page, share the link, draw together. Your strokes go directly to the other person's browser — peer-to-peer, end-to-end, nothing stored anywhere.

🔗 **Live:** https://pws-wobbuffet.github.io/peerdraw/

## How it works

1. Person A opens the app and clicks **Create session** — a room link appears
2. Person A shares the link (or generates a QR via [privqr](https://pws-wobbuffet.github.io/privqr/))
3. Person B opens the link — connection established in ~1s
4. Draw together in real time

The only "server" involved is PeerJS's public signaling relay, used for the initial WebRTC handshake (~1 second). After that it's purely peer-to-peer and the relay is completely out of the picture. Drawing data never touches any server.

## Run locally

```bash
git clone https://github.com/pws-wobbuffet/peerdraw.git
cd peerdraw
pnpm install
pnpm dev
# open http://localhost:4321/peerdraw/
```

## Stack

- [Astro](https://astro.build) + [React](https://react.dev) — static build, zero server
- [PeerJS](https://peerjs.com) — WebRTC DataChannel wrapper + signaling
- HTML5 Canvas API — pointer events, quadratic bezier smoothing
- GitHub Pages via GitHub Actions

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
