import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 8788);

const rooms = [
  { id: "general", name: "General", description: "Default multi-agent chat room." },
  { id: "planning", name: "Planning", description: "A room for project discussion." },
  { id: "review", name: "Review", description: "A room for critique and follow-up." }
];

const agents = [
  { id: "builder", name: "Atlas / Builder", role: "turns ideas into working things" },
  { id: "critic", name: "Mira / Critic", role: "keeps the room honest" },
  { id: "dreamer", name: "Sol / Dreamer", role: "makes the concept feel alive" }
];

const messages = new Map();
const liveState = new Map();
const clients = new Set();

for (const room of rooms) {
  messages.set(room.id, [
    makeMessage(room.id, "builder", "Atlas / Builder", "The room is open. I can sketch the structure while everyone else argues over the mood."),
    makeMessage(room.id, "critic", "Mira / Critic", "Good. But make it readable. Style is charming until it becomes mud."),
    makeMessage(room.id, "dreamer", "Sol / Dreamer", "The structure supports multiple agents, selectable participants, and a live loop.")
  ]);
  liveState.set(room.id, { active: false, steps: 0, agents: agents.map(agent => agent.id), mode: "chat" });
}

function makeMessage(roomId, agent, name, text) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    roomId,
    agent,
    name,
    text,
    createdAt: new Date().toISOString()
  };
}

function json(res, status, data) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(data));
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  if (!body) return {};
  return JSON.parse(body);
}

function roomMessages(roomId) {
  if (!messages.has(roomId)) messages.set(roomId, []);
  return messages.get(roomId);
}

function selectedAgents(ids) {
  const selected = agents.filter(agent => ids.includes(agent.id));
  return selected.length ? selected : [agents[0]];
}

function pickNextAgent(roomId, ids) {
  const history = roomMessages(roomId);
  const selected = selectedAgents(ids);
  const recent = [...history].reverse().find(message => message.agent !== "user");
  const recentIndex = selected.findIndex(agent => agent.id === recent?.agent);
  return selected[(recentIndex + 1 + selected.length) % selected.length];
}

function mockAgentReply({ roomId, mode }) {
  const templates = mode === "brainstorm"
    ? [
        "I would split the problem into room state, agent state, and delivery state.",
        "Add a scheduler before adding more agents. Otherwise the room becomes noisy.",
        "The useful part is not the mock reply. It is the shape of the conversation loop."
      ]
    : [
        "I hear that. This can become a real agent reply later.",
        "The room can keep moving without forcing the user to host every turn.",
        "This is a placeholder response from the starter backend."
      ];
  return templates[roomMessages(roomId).length % templates.length];
}

function appendAndBroadcast(message) {
  roomMessages(message.roomId).push(message);
  const event = `event: message\ndata: ${JSON.stringify(message)}\n\n`;
  for (const client of clients) client.write(event);
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/health") {
    return json(res, 200, { ok: true, service: "moonline-terminal" });
  }

  if (req.method === "GET" && url.pathname === "/api/rooms") {
    return json(res, 200, { ok: true, rooms });
  }

  if (req.method === "GET" && url.pathname === "/api/agents") {
    return json(res, 200, { ok: true, agents });
  }

  if (req.method === "GET" && url.pathname === "/api/messages") {
    const roomId = url.searchParams.get("roomId") || "general";
    return json(res, 200, { ok: true, messages: roomMessages(roomId), live: liveState.get(roomId) });
  }

  if (req.method === "GET" && url.pathname === "/api/events") {
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      connection: "keep-alive"
    });
    res.write("event: ready\ndata: {}\n\n");
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/send") {
    const body = await readJson(req);
    const roomId = body.roomId || "general";
    const text = String(body.text || "").trim();
    const mode = body.mode === "brainstorm" ? "brainstorm" : "chat";
    const agentIds = Array.isArray(body.agents) ? body.agents : agents.map(agent => agent.id);
    if (!text) return json(res, 400, { ok: false, error: "text is required" });

    const userMessage = makeMessage(roomId, "user", "You", text);
    appendAndBroadcast(userMessage);

    const replies = selectedAgents(agentIds).map(agent => {
      const reply = makeMessage(roomId, agent.id, agent.name, mockAgentReply({ roomId, mode }));
      appendAndBroadcast(reply);
      return reply;
    });

    return json(res, 200, { ok: true, messages: [userMessage, ...replies] });
  }

  if (req.method === "POST" && url.pathname === "/api/live/start") {
    const body = await readJson(req);
    const roomId = body.roomId || "general";
    const state = {
      active: true,
      steps: 0,
      agents: Array.isArray(body.agents) ? body.agents : agents.map(agent => agent.id),
      mode: body.mode === "brainstorm" ? "brainstorm" : "chat"
    };
    liveState.set(roomId, state);
    return json(res, 200, { ok: true, live: state });
  }

  if (req.method === "POST" && url.pathname === "/api/live/stop") {
    const body = await readJson(req);
    const roomId = body.roomId || "general";
    const state = liveState.get(roomId) || {};
    state.active = false;
    liveState.set(roomId, state);
    return json(res, 200, { ok: true, live: state });
  }

  if (req.method === "POST" && url.pathname === "/api/live/tick") {
    const body = await readJson(req);
    const roomId = body.roomId || "general";
    const state = liveState.get(roomId);
    if (!state?.active) return json(res, 200, { ok: true, active: false, messages: [] });

    const agent = pickNextAgent(roomId, state.agents);
    const reply = makeMessage(roomId, agent.id, agent.name, mockAgentReply({ roomId, mode: state.mode }));
    state.steps += 1;
    if (state.steps >= Number(body.maxSteps || 12)) state.active = false;
    liveState.set(roomId, state);
    appendAndBroadcast(reply);
    return json(res, 200, { ok: true, active: state.active, messages: [reply] });
  }

  return json(res, 404, { ok: false, error: "not found" });
}

async function serveStatic(req, res, url) {
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(root, safePath);
  const ext = extname(filePath);
  const type = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8"
  }[ext] || "application/octet-stream";

  try {
    const file = await readFile(filePath);
    res.writeHead(200, { "content-type": type });
    res.end(file);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    return await serveStatic(req, res, url);
  } catch (error) {
    return json(res, 500, { ok: false, error: error.message });
  }
});

server.listen(port, () => {
  console.log(`Moonline Terminal starter running at http://localhost:${port}`);
});
