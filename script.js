// ─────────────────────────────────────────────────────────────
//  შენი ლეგენდარული გამონათქვამები 🐢
//
//  ჩანაწერები ინახება ბექენდში (/api/notes → Upstash Redis) — ანუ
//  საერთოა ყველა მოწყობილობაზე. თუ ბექენდი მიუწვდომელია (ჯერ არ
//  დაგიყენებია, ან offline ხარ), ავტომატურად გადადის ლოკალურ რეჟიმზე
//  (ამ მოწყობილობის localStorage).
// ─────────────────────────────────────────────────────────────

const API = "/api/notes";
const STORAGE_KEY = "turtle-notes-v1"; // ლოკალური რეზერვი

// ქართული თვეები — თარიღი ყოველთვის ქართულად
const KA_MONTHS = [
  "იანვარი", "თებერვალი", "მარტი", "აპრილი", "მაისი", "ივნისი",
  "ივლისი", "აგვისტო", "სექტემბერი", "ოქტომბერი", "ნოემბერი", "დეკემბერი",
];

// წინასწარ შევსება — მხოლოდ ლოკალურ რეჟიმში (ბექენდი თუ არ არის).
// მაგ: const SEED_NOTES = ["შენი პირველი გენიალური ფრაზა"];
const SEED_NOTES = [];

// ── DOM ──
const input    = document.getElementById("note-input");
const addBtn   = document.getElementById("add-btn");
const list     = document.getElementById("notes");
const empty    = document.getElementById("empty");
const counter  = document.getElementById("counter");
const badge    = document.getElementById("count-badge");
const modeHint = document.getElementById("mode-hint");

// ── მდგომარეობა ──
let notes = [];
let apiOK = false; // ბექენდი ხელმისაწვდომია?

init();

// ── მოვლენები ──
addBtn.addEventListener("click", addNote);

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    addNote();
  }
});

input.addEventListener("input", () => {
  autoGrow();
  updateCounter();
});

// ── ინიციალიზაცია ──
async function init() {
  showLoading();
  try {
    const r = await fetch(API, { method: "GET" });
    if (!r.ok) throw new Error("api");
    const data = await r.json();
    notes = Array.isArray(data.notes) ? data.notes : [];
    apiOK = true;
  } catch {
    apiOK = false;
    notes = loadLocal();
    if (notes.length === 0 && SEED_NOTES.length > 0) {
      notes = SEED_NOTES.map(makeNote);
      saveLocal();
    }
  }
  render();
  updateMode();
}

// ── ჩანაწერის მოდელი (ლოკალური რეჟიმისთვის) ──
function makeNote(text) {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    text: String(text).trim(),
    ts: Date.now(),
  };
}

// ── დამატება ──
async function addNote() {
  const text = input.value.trim();
  if (!text) { input.focus(); return; }

  input.value = "";
  autoGrow();
  updateCounter();

  if (apiOK) {
    try {
      const r = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!r.ok) throw new Error();
      const { note } = await r.json();
      notes.unshift(note);
      render();
    } catch {
      flash("ვერ დაემატა — სცადე თავიდან");
    }
  } else {
    notes.unshift(makeNote(text));
    saveLocal();
    render();
  }
  input.focus();
}

// ── წაშლა ──
async function deleteNote(id) {
  const card = list.querySelector(`[data-id="${id}"]`);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (apiOK) {
    try {
      const r = await fetch(`${API}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!r.ok) throw new Error();
    } catch {
      flash("ვერ წაიშალა — სცადე თავიდან");
      return;
    }
  }

  if (card && !reduced) card.classList.add("removing");

  const done = () => {
    notes = notes.filter((n) => n.id !== id);
    if (!apiOK) saveLocal();
    render();
  };

  if (card && !reduced) setTimeout(done, 200);
  else done();
}

// ── რენდერი ──
function render() {
  list.innerHTML = "";

  const hasNotes = notes.length > 0;
  empty.hidden = hasNotes;
  badge.textContent = hasNotes ? `${notes.length} გამონათქვამი` : "";

  notes.forEach((note) => {
    const card = document.createElement("article");
    card.className = "note";
    card.dataset.id = note.id;
    card.style.transform = `rotate(${rotationFor(note.id)}deg)`;

    const text = document.createElement("p");
    text.className = "note__text";
    text.textContent = note.text;

    const date = document.createElement("time");
    date.className = "note__date";
    date.textContent = formatDate(note.ts);

    const del = document.createElement("button");
    del.className = "note__del";
    del.type = "button";
    del.setAttribute("aria-label", "ჩანაწერის წაშლა");
    del.textContent = "✕";
    del.addEventListener("click", () => deleteNote(note.id));

    card.append(del, text, date);
    list.appendChild(card);
  });
}

function showLoading() {
  empty.hidden = true;
  list.innerHTML = '<p class="loading">იტვირთება…</p>';
}

function updateMode() {
  if (!modeHint) return;
  modeHint.textContent = apiOK
    ? "ჩანაწერები საერთოა ყველა მოწყობილობაზე ☁️"
    : "ლოკალური რეჟიმი — ჩანაწერები ამ მოწყობილობაზე 💾";
}

// counter ველში დროებითი შეტყობინება
let flashTimer;
function flash(msg) {
  counter.textContent = msg;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(updateCounter, 2500);
}

function updateCounter() {
  const len = input.value.length;
  counter.textContent = len > 0 ? `${len}/280` : "";
}

function autoGrow() {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 128) + "px";
}

// მდგრადი მცირე დახრა id-ს მიხედვით: -3°..3°
function rotationFor(id) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 1000;
  return (h / 1000) * 6 - 3;
}

function formatDate(ts) {
  try {
    const d = new Date(ts);
    return `${d.getDate()} ${KA_MONTHS[d.getMonth()]}, ${d.getFullYear()}`;
  } catch {
    return "";
  }
}

// ── ლოკალური რეზერვი ──
function saveLocal() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(notes)); }
  catch (e) { console.warn("ვერ შევინახე:", e); }
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // ძველი ფორმატის თავსებადობა (date → ts)
    return Array.isArray(parsed)
      ? parsed.map((n) => ({ id: n.id, text: n.text, ts: n.ts || Date.parse(n.date) || Date.now() }))
      : [];
  } catch { return []; }
}

// ─────────────────────────────────────────────────────────────
//  კუ, რომელიც კურსორს (მაუსს) ან თითს ყვება — მსუბუქი ჩამორჩენით
// ─────────────────────────────────────────────────────────────
(function turtleFollower() {
  const el = document.getElementById("turtle-cursor");
  if (!el) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let tx = -100, ty = -100;   // სამიზნე (pointer-ის კოორდინატები)
  let cx = -100, cy = -100;   // მიმდინარე (კუს პოზიცია)
  let shown = false;

  function onMove(e) {
    tx = e.clientX;
    ty = e.clientY;
    if (!shown) { shown = true; el.style.opacity = "1"; }
  }

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerdown", onMove, { passive: true });

  function loop() {
    const k = reduce ? 1 : 0.18; // ჩამორჩენის სიგლუვე
    cx += (tx - cx) * k;
    cy += (ty - cy) * k;
    el.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
