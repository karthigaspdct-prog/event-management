const EV = "ee_events", RG = "ee_regs";
const load = (k) => { try { return JSON.parse(localStorage.getItem(k) || "[]"); } catch (e) { return []; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nowStr = () => new Date().toLocaleString("en-IN");

// Sample events on first run
if (!localStorage.getItem(EV)) {
  save(EV, [
    { id: "E1", name: "Tech Symposium 2026", date: "2026-12-10", venue: "Main Auditorium", capacity: 100 },
    { id: "E2", name: "Hackathon", date: "2026-12-15", venue: "CSE Lab", capacity: 50 },
    { id: "E3", name: "Cultural Fest", date: "2026-12-20", venue: "Open Ground", capacity: 200 },
  ]);
}

function ticketId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const used = load(RG).map((r) => r.ticket);
  let id;
  do {
    id = "EE-" + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (used.includes(id));
  return id;
}

const eventName = (id) => (load(EV).find((e) => e.id === id) || { name: "(deleted event)" }).name;

// ---------- Tabs ----------
document.querySelectorAll(".tab").forEach((b) =>
  b.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    $(b.dataset.tab).classList.add("active");
    refresh();
  })
);

// ---------- Events ----------
function renderEvents() {
  const regs = load(RG);
  $("eventList").innerHTML = load(EV)
    .map((e) => {
      const taken = regs.filter((r) => r.eventId === e.id).length;
      const left = e.capacity - taken;
      return `<div class="event">
        <h3>${esc(e.name)}</h3>
        <p>📅 ${esc(e.date)}</p>
        <p>📍 ${esc(e.venue)}</p>
        <span class="badge ${left <= 0 ? "full" : ""}">${left <= 0 ? "Full" : left + " seats left"}</span>
      </div>`;
    })
    .join("");
  const opts = load(EV).map((e) => `<option value="${esc(e.id)}">${esc(e.name)}</option>`).join("");
  const keepReg = $("regEvent").value, keepAtt = $("attEvent").value;
  $("regEvent").innerHTML = opts;
  $("attEvent").innerHTML = opts;
  if (keepReg) $("regEvent").value = keepReg;
  if (keepAtt) $("attEvent").value = keepAtt;
}

$("eventForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const list = load(EV);
  list.push({
    id: "E" + Date.now(),
    name: f.get("name").trim(),
    date: f.get("date"),
    venue: f.get("venue").trim(),
    capacity: parseInt(f.get("capacity"), 10),
  });
  save(EV, list);
  e.target.reset();
  refresh();
});

// ---------- Ticket card ----------
function ticketHTML(r) {
  const ev = load(EV).find((x) => x.id === r.eventId);
  return `<div class="ticket">
    <div class="qr" id="qr-${esc(r.ticket)}"></div>
    <div>
      <h3>${esc(eventName(r.eventId))}</h3>
      <p>📅 ${esc(ev ? ev.date : "-")} &nbsp; 📍 ${esc(ev ? ev.venue : "-")}</p>
      <p><strong>${esc(r.name)}</strong> (${esc(r.roll)}, ${esc(r.dept)})</p>
      <p>Ticket ID: <span class="tid">${esc(r.ticket)}</span></p>
      <p>Status: <span class="${r.status === "Present" ? "present" : ""}">${esc(r.status)}</span></p>
    </div>
  </div>`;
}

function drawQR(r) {
  const box = document.getElementById("qr-" + r.ticket);
  if (!box) return;
  if (typeof QRCode !== "undefined") {
    new QRCode(box, { text: r.ticket, width: 128, height: 128 });
  } else {
    box.innerHTML = '<p class="muted">QR unavailable offline.<br>Use the Ticket ID.</p>';
  }
}

// ---------- Register ----------
$("regForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const eventId = f.get("eventId");
  const roll = f.get("roll").trim().toUpperCase();
  const ev = load(EV).find((x) => x.id === eventId);
  const regs = load(RG);
  const msg = $("regMsg");
  msg.textContent = "";
  $("regTicket").innerHTML = "";

  if (!ev) { msg.textContent = "Please select an event."; return; }
  if (regs.some((r) => r.eventId === eventId && r.roll === roll)) {
    msg.textContent = "This roll number is already registered for this event."; return;
  }
  if (regs.filter((r) => r.eventId === eventId).length >= ev.capacity) {
    msg.textContent = "Sorry, this event is full."; return;
  }
  const reg = {
    ticket: ticketId(), eventId, roll,
    name: f.get("name").trim(), dept: f.get("dept").trim(), email: f.get("email").trim(),
    status: "Registered", time: nowStr(),
  };
  regs.push(reg);
  save(RG, regs);
  e.target.reset();
  $("regTicket").innerHTML = ticketHTML(reg);
  drawQR(reg);
  renderEvents();
});

// ---------- My Ticket ----------
$("findForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = $("findId").value.trim().toUpperCase();
  const r = load(RG).find((x) => x.ticket === id);
  if (!r) { $("findResult").innerHTML = '<p class="error">No ticket found with that ID.</p>'; return; }
  $("findResult").innerHTML = ticketHTML(r);
  drawQR(r);
});

// ---------- Attendance ----------
function renderAttendance() {
  const eventId = $("attEvent").value;
  const rows = load(RG).filter((r) => r.eventId === eventId);
  const present = rows.filter((r) => r.status === "Present").length;
  $("sTotal").textContent = rows.length;
  $("sPresent").textContent = present;
  $("sAbsent").textContent = rows.length - present;
  $("sPercent").textContent = rows.length ? Math.round((present / rows.length) * 100) + "%" : "0%";
  $("attEmpty").style.display = rows.length ? "none" : "block";
  $("attBody").innerHTML = rows
    .map((r) => `<tr>
      <td>${esc(r.ticket)}</td><td>${esc(r.name)}</td><td>${esc(r.roll)}</td><td>${esc(r.dept)}</td>
      <td class="${r.status === "Present" ? "present" : ""}">${esc(r.status)}</td>
      <td><button class="small" data-del="${esc(r.ticket)}">Remove</button></td>
    </tr>`)
    .join("");
}

$("attEvent").addEventListener("change", renderAttendance);

$("markForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = $("markId").value.trim().toUpperCase();
  const regs = load(RG);
  const r = regs.find((x) => x.ticket === id);
  const msg = $("markMsg");
  if (!r) { msg.className = "error"; msg.textContent = "Invalid ticket ID."; return; }
  if (r.eventId !== $("attEvent").value) {
    msg.className = "error"; msg.textContent = "This ticket is for a different event: " + eventName(r.eventId); return;
  }
  if (r.status === "Present") { msg.className = "error"; msg.textContent = r.name + " is already marked present."; return; }
  r.status = "Present";
  r.time = nowStr();
  save(RG, regs);
  msg.className = "success";
  msg.textContent = "✔ " + r.name + " marked present.";
  $("markId").value = "";
  renderAttendance();
});

$("attBody").addEventListener("click", (e) => {
  const id = e.target.dataset.del;
  if (!id || !confirm("Remove this registration?")) return;
  save(RG, load(RG).filter((r) => r.ticket !== id));
  refresh();
});

function refresh() { renderEvents(); renderAttendance(); }
refresh();
