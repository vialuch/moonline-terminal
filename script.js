const channels = [
  { frequency: "Room", name: "General", line: "Default multi-agent chat room." },
  { frequency: "Room", name: "Planning", line: "A room for project discussion." },
  { frequency: "Room", name: "Review", line: "A room for critique and follow-up." }
];

const agents = [
  { id: "builder", name: "Atlas / Builder", role: "turns ideas into working things", badge: "A" },
  { id: "critic", name: "Mira / Critic", role: "keeps the room honest", badge: "M" },
  { id: "dreamer", name: "Sol / Dreamer", role: "makes the concept feel alive", badge: "S" }
];

const starterMessages = [
  { agent: "builder", name: "Atlas / Builder", text: "The room is open. I can sketch the structure while everyone else argues over the mood." },
  { agent: "critic", name: "Mira / Critic", text: "Good. But make it readable. Style is charming until it becomes mud." },
  { agent: "dreamer", name: "Sol / Dreamer", text: "The structure supports multiple agents, selectable participants, and a live loop." },
  { agent: "user", name: "You", text: "Make the interaction easy to adapt." }
];

const replies = {
  chat: [
    "Message received. This mock reply can be replaced by a real agent response.",
    "Keep the layout readable first, then add your own visual system.",
    "This is where a real backend could stream each agent at its own pace."
  ],
  brainstorm: [
    "Idea: channels can become project rooms, moods, or temporary sessions.",
    "Add presence, typing states, and a real stop button before adding more power.",
    "The magic is in letting the agents talk to each other while the user watches."
  ]
};

const state = {
  channel: channels[0],
  mode: "chat",
  selectedAgents: agents.map(agent => agent.id),
  messages: [...starterMessages],
  live: false,
  liveTimer: null
};

const els = {
  channelList: document.getElementById("channelList"),
  agentStrip: document.getElementById("agentStrip"),
  memberList: document.getElementById("memberList"),
  messages: document.getElementById("messages"),
  text: document.getElementById("text"),
  send: document.getElementById("send"),
  live: document.getElementById("live"),
  statusText: document.getElementById("statusText"),
  roomTitle: document.getElementById("roomTitle"),
  frequencyNumber: document.getElementById("frequencyNumber"),
  frequencyName: document.getElementById("frequencyName"),
  tuner: document.getElementById("tuner"),
  wall: document.getElementById("wall"),
  overlay: document.getElementById("overlay"),
  tuningOverlay: document.getElementById("tuningOverlay"),
  tuningText: document.getElementById("tuningText")
};

function escapeHtml(value) {
  return String(value).replace(/[&<>]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[char]));
}

function renderChannels() {
  els.channelList.innerHTML = channels.map(channel => `
    <button class="channel-card ${channel === state.channel ? "active" : ""}" data-frequency="${channel.frequency}" type="button">
      <div class="channel-top">
        <span class="channel-frequency">${channel.frequency}</span>
        <span class="signal-light"></span>
      </div>
      <div class="channel-name">${escapeHtml(channel.name)}</div>
      <div class="channel-line">${escapeHtml(channel.line)}</div>
    </button>
  `).join("");

  els.channelList.querySelectorAll(".channel-card").forEach(button => {
    button.addEventListener("click", () => {
      const next = channels.find(channel => channel.frequency === button.dataset.frequency);
      if (!next) return;
      state.channel = next;
      updateChannelHeader();
      renderChannels();
      showTuning(`${next.frequency} ${next.name}`);
      closeDrawers();
    });
  });
}

function renderAgents() {
  els.agentStrip.innerHTML = agents.map(agent => `
    <button class="agent-button ${state.selectedAgents.includes(agent.id) ? "active" : ""}" data-agent="${agent.id}" type="button">
      <span class="agent-badge">${agent.badge}</span>
      <span>${escapeHtml(agent.name)}</span>
    </button>
  `).join("");

  els.agentStrip.querySelectorAll(".agent-button").forEach(button => {
    button.addEventListener("click", () => {
      const id = button.dataset.agent;
      if (state.selectedAgents.includes(id)) {
        state.selectedAgents = state.selectedAgents.filter(agentId => agentId !== id);
      } else {
        state.selectedAgents.push(id);
      }
      if (!state.selectedAgents.length) state.selectedAgents = [id];
      renderAgents();
    });
  });
}

function renderMembers() {
  els.memberList.innerHTML = [
    { name: "You", role: "room operator", badge: "Y" },
    ...agents
  ].map(member => `
    <div class="member-card">
      <span class="avatar">${member.badge}</span>
      <div>
        <div class="member-name">${escapeHtml(member.name)}</div>
        <div class="member-role">${escapeHtml(member.role)}</div>
      </div>
      <span class="signal-light"></span>
    </div>
  `).join("");
}

function renderMessages() {
  els.messages.innerHTML = state.messages.map(message => {
    const agent = agents.find(item => item.id === message.agent);
    const badge = agent ? agent.badge : "Y";
    const cls = message.agent === "user" ? "user" : message.agent;
    return `
      <article class="message ${cls}">
        <div class="avatar">${badge}</div>
        <div class="message-body">
          <div class="meta">${escapeHtml(message.name)}</div>
          <div class="bubble">${escapeHtml(message.text)}</div>
        </div>
      </article>
    `;
  }).join("");

  requestAnimationFrame(() => {
    els.messages.scrollTop = els.messages.scrollHeight;
  });
}

function updateChannelHeader() {
  els.roomTitle.textContent = `${state.channel.frequency} ${state.channel.name}`;
  els.frequencyNumber.textContent = state.channel.frequency;
  els.frequencyName.textContent = state.channel.name;
}

function selectedAgentObjects() {
  return agents.filter(agent => state.selectedAgents.includes(agent.id));
}

function nextAgent(index = state.messages.length) {
  const selected = selectedAgentObjects();
  return selected[index % selected.length] || agents[0];
}

function addAgentReply() {
  const agent = nextAgent();
  const pool = replies[state.mode];
  const text = pool[state.messages.length % pool.length];
  state.messages.push({ agent: agent.id, name: agent.name, text });
  renderMessages();
}

function send() {
  const text = els.text.value.trim();
  if (!text) return;
  state.messages.push({ agent: "user", name: "You", text });
  els.text.value = "";
  resizeTextArea();
  selectedAgentObjects().forEach((agent, index) => {
    const pool = replies[state.mode];
    state.messages.push({ agent: agent.id, name: agent.name, text: pool[index % pool.length] });
  });
  renderMessages();
  setStatus("Signal complete. This demo uses local mock replies.");
}

function toggleLive() {
  state.live = !state.live;
  els.live.textContent = state.live ? "Stop" : "Live";
  els.live.classList.toggle("running", state.live);
  setStatus(state.live ? "Live mode is running with local mock replies." : "Live mode stopped.");
  if (state.live) {
    state.liveTimer = window.setInterval(addAgentReply, 1800);
  } else {
    window.clearInterval(state.liveTimer);
  }
}

function setStatus(text) {
  els.statusText.textContent = text;
}

function resizeTextArea() {
  els.text.style.height = "auto";
  els.text.style.height = Math.min(138, els.text.scrollHeight) + "px";
}

function closeDrawers() {
  els.tuner.classList.remove("open");
  els.wall.classList.remove("open");
  els.overlay.classList.remove("show");
}

function openDrawer(which) {
  closeDrawers();
  els[which].classList.add("open");
  els.overlay.classList.add("show");
}

function showTuning(label) {
  els.tuningText.textContent = `OPENING ${label.toUpperCase()}`;
  els.tuningOverlay.classList.add("show");
  window.setTimeout(() => els.tuningOverlay.classList.remove("show"), 680);
}

document.querySelectorAll("[data-mode]").forEach(button => {
  button.addEventListener("click", () => {
    state.mode = button.dataset.mode;
    document.querySelectorAll("[data-mode]").forEach(item => item.classList.toggle("active", item === button));
    setStatus(state.mode === "brainstorm" ? "Think mode: each agent contributes an angle." : "Chat mode: short, intimate, alive.");
  });
});

document.getElementById("openTuner").addEventListener("click", () => openDrawer("tuner"));
document.getElementById("openWall").addEventListener("click", () => openDrawer("wall"));
document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", closeDrawers));
els.overlay.addEventListener("click", closeDrawers);
els.send.addEventListener("click", send);
els.live.addEventListener("click", toggleLive);
els.text.addEventListener("input", resizeTextArea);
els.text.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    send();
  }
});

renderChannels();
renderAgents();
renderMembers();
updateChannelHeader();
renderMessages();
