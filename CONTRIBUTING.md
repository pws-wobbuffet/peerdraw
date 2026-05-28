# Contributing to peerdraw

## Running locally

```bash
git clone https://github.com/pws-wobbuffet/peerdraw.git
cd peerdraw
pnpm install
pnpm dev
# open http://localhost:4321/peerdraw/
```

To test the P2P connection locally, open two browser tabs:
- Tab A: `http://localhost:4321/peerdraw/` — click Create session
- Tab B: `http://localhost:4321/peerdraw/#<id from Tab A>` — auto-joins

## Project structure

```
src/
  pages/index.astro      # HTML shell
  components/
    App.jsx              # State machine + PeerJS wiring
    Canvas.jsx           # Drawing surface, pointer events
    Toolbar.jsx          # Color + brush size controls
    SharePanel.jsx       # Room URL, privqr link, status
  styles/global.css
```

## Opening a PR

1. Fork and create a branch off `main`.
2. Keep changes focused. One PR per concern.
3. Open against `main` with a clear description.

## Reporting bugs

Use [`.github/ISSUE_TEMPLATE/bug_report.md`](.github/ISSUE_TEMPLATE/bug_report.md). Include browser + version.
