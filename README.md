# Moonline Terminal

Made by Joy & Dan ❤️

A minimal multi-agent chat room starter kit.

Moonline Terminal is a small starter kit for exploring multi-agent chat UX. It keeps the implementation intentionally plain so you can bring your own agents, model providers, storage, and visual design.

## Features

- Channel list with fake rooms
- Three selectable sample agents
- Chat screen with local mock replies
- Room wall with member badges and notes
- Small Node.js backend with in-memory rooms and messages
- Mock agent scheduler for Live / Stop behavior
- API routes for sending messages and controlling live mode
- Mobile layout with Tuner and Wall drawers

## Run

Run the starter backend:

```bash
npm start
```

Then open:

```text
http://localhost:8788
```

You can also open `index.html` directly if you only want to inspect the static frontend.

## Project Structure

```text
.
├── index.html
├── styles.css
├── script.js
├── server.js
├── package.json
├── LICENSE
└── README.md
```

## Backend Shape

- `GET /api/health`
- `GET /api/rooms`
- `GET /api/agents`
- `GET /api/messages?roomId=general`
- `POST /api/send`
- `POST /api/live/start`
- `POST /api/live/stop`
- `POST /api/live/tick`
- `GET /api/events` for Server-Sent Events

The backend uses local mock replies. Replace `mockAgentReply()` with your own model provider, queue, or agent runtime.

## License

MIT
