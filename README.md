# AISync Demo FE

Local-only frontend demo for the AISync workflow. The app ships with seed data and runs without a backend.

## Run locally

```bash
npm install
npm run dev
```

Default URL: `http://localhost:5173`

If Windows PowerShell blocks `npm.ps1`, use:

```bash
npm.cmd install
npm.cmd run dev
```

## What is included

- Page A: Tri-Chat Workspace with 3 chat columns, message selection, forwarding, and per-session refresh.
- Page B: Documentation Mode with project file trees, file viewer, save-from-chat flow, prompts library, and project creation.
- Page C: Traceability Calendar with month navigation and clickable file events.
- Local persistence through `localStorage`.

## 60-second demo script

1. Open the app. You land on Page A.
2. Select 2 messages in the Manager chat.
3. Choose `Worker 1` in the forward bar and click `Send to`.
4. Open the `+ Worker` panel for Worker 1 and confirm the forwarded block appears.
5. Click `Documentation Mode`.
6. In the Manager panel, select messages or leave selection empty, then click `Save as file`.
7. Save the file as `Report` under `Project 1`.
8. Confirm the new file appears in the project tree and opens in the viewer modal.
9. Open `Advanced`, then `Traceability Calendar`.
10. Confirm the saved file created a new event on the selected date and that clicking it opens the same file viewer.

## Data persisted in localStorage

The app stores:

- projects
- chat messages by agent
- worker role labels
- drafts
- saved files
- calendar events

To reset the demo, remove `aisync_demo_state_v2` from browser `localStorage`.
