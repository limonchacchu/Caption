(function () {
  "use strict";
  const cfg = window.SITE_CONFIG || {};
  const $ = (s) => document.querySelector(s), $$ = (s) => Array.from(document.querySelectorAll(s));
  const toast = (m) => { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 2400); };
  const FONTS = ["Hind Siliguri", "Noto Serif Bengali", "Tiro Bangla", "Baloo Da 2", "Noto Sans Bengali", "Atma", "Galada"];
  const BGS = [["#ff758c","#ff7eb3"],["#232526","#414345"],["#0f5132","#198754"],["#f6d365","#fda085"],["#1e3c72","#2a5298"],["#f093fb","#f5576c"],["#a18cd1","#fbc2eb"],["#000000","#c31432"],["#43cea2","#185a9d"],["#fceabb","#f8b500"]];
  const SIZES = { sq: [1080,1080], pt: [1080,1350], st: [1080,1920], ls: [1920,1080] };
  const TPL = [
    { n:"Love Caption", sz:"sq", g:["#ff758c","#ff7eb3"], t:"ভালোবাসা মানে নীরবতাতেও পাশে থাকা।", f:"Hind Siliguri", c:"#ffffff" },
    { n:"Sad Quote", sz:"sq", g:["#232526","#414345"], t:"কিছু কথা বলা হয় না, শুধু বুকের ভেতর জমে থাকে।", f:"Noto Serif Bengali", c:"#e8e8e8" },
    { n:"Islamic Quote", sz:"sq", g:["#0f5132","#198754"], t:"ধৈর্য ধরো, আল্লাহ সবচেয়ে ভালো সময়েই সবকিছু দেন।", f:"Noto Serif Bengali", c:"#ffe08a" },
    { n:"Attitude Caption", sz:"sq", g:["#000000","#c31432"], t:"নিজের পথ নিজেই বানাই, ভিড়ে হারাতে শিখিনি।", f:"Baloo Da 2", c:"#ffffff", wt:700 },
    { n:"Friendship Quote", sz:"sq", g:["#f6d365","#fda085"], t:"সত্যিকারের বন্ধু সেই, যে চুপ থাকলেও তোমার মন বোঝে।", f:"Hind Siliguri", c:"#3a1f12" },
    { n:"Motivational Quote", sz:"sq", g:["#1e3c72","#2a5298"], t:"আজকের ছোট চেষ্টাই আগামীকালের বড় সাফল্য।", f:"Hind Siliguri", c:"#ffffff" },
    { n:"Birthday Post", sz:"pt", g:["#f093fb","#f5576c"], t:"শুভ জন্মদিন! তোমার জীবন হোক হাসি আর আনন্দে ভরা।", f:"Galada", c:"#ffffff", top:"🎂 Happy Birthday" },
    { n:"Romantic Post", sz:"pt", g:["#a18cd1","#fbc2eb"], t:"তুমি এলে বসন্ত আসে, তুমি গেলে নীরব আকাশ।", f:"Tiro Bangla", c:"#3b1d4a" },
    { n:"Facebook Post", sz:"ls", g:["#43cea2","#185a9d"], t:"জীবন ছোট, তাই মন খুলে হাসো আর ক্ষমা করতে শেখো।", f:"Hind Siliguri", c:"#ffffff" },
    { n:"Instagram Post", sz:"pt", g:["#fceabb","#f8b500"], t:"আমি যেমন, তেমনই ভালো।", f:"Atma", c:"#3a2a00", wt:700 },
    { n:"Story Design", sz:"st", g:["#00c6ff","#0072ff"], t:"পড়ে গেলে লজ্জা নেই, না উঠলেই হার।", f:"Baloo Da 2", c:"#ffffff", wt:700 }
  ];
  const KEY = "lcg_designs";
  const uid = () => Math.random().toString(36).slice(2, 9);
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16); }));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const cv = $("#cv"), ctx = cv.getContext("2d"), mctx = document.createElement("canvas").getContext("2d");
  const imgStore = new Map(), imgEl = new Map(); let imgSeq = 0;
  let S, last, selId = null, curId = null, userText = "", drag = null, guides = { x: false, y: false };
  const undoSt = [], redoSt = [];
  let sb = null, user = null;

  // ---------- model ----------
  const defaultBg = () => ({ type: "gradient", color: "#ffffff", g1: "#ff758c", g2: "#ff7eb3", angle: 135, imgId: null, blur: 0, bright: 100, overlay: 0, overlayColor: "#000000", px: 50, py: 50 });
  const wmDefault = () => { const w = cfg.WATERMARK || {}; return { on: w.enabled !== false, pos: w.position || "br", opacity: w.opacity != null ? w.opacity : 0.5 }; };
  const newEl = (o) => Object.assign({ id: uid(), text: "", x: S.w / 2, y: S.h / 2, w: S.w * 0.8, fontSize: Math.round(S.w * 0.06), font: "Hind Siliguri", weight: 600, color: "#ffffff", align: "center", lh: 1.5, ls: 0, shadow: true, outline: 0, outlineColor: "#000000", bg: false, bgColor: "#000000", rot: 0 }, o);
  const cur = () => S.els.find((e) => e.id === selId) || null;
  const snap = () => JSON.stringify(S);

  // ---------- layout & drawing ----------
  const fontStr = (e) => `${e.weight} ${e.fontSize}px "${e.font}", sans-serif`;
  function layout(e) {
    const m = mctx; m.font = fontStr(e); if ("letterSpacing" in m) m.letterSpacing = e.ls + "px";
    const pad = e.fontSize * 0.3, maxW = Math.max(e.fontSize, e.w - pad * 2), lines = [];
    String(e.text).split("\n").forEach((par) => {
      if (!par) { lines.push(""); return; }
      let curL = "";
      par.split(" ").forEach((wd) => { const t = curL ? curL + " " + wd : wd; if (!curL || m.measureText(t).width <= maxW) curL = t; else { lines.push(curL); curL = wd; } });
      lines.push(curL);
    });
    const lh = e.fontSize * e.lh; return { lines, lh, pad, h: lines.length * lh + pad * 2 };
  }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function drawBg(c, st) {
    const b = st.bg, w = st.w, h = st.h;
    if (b.type === "gradient") {
      const a = b.angle * Math.PI / 180, r = Math.abs(w * Math.sin(a)) / 2 + Math.abs(h * Math.cos(a)) / 2, dx = Math.sin(a) * r, dy = -Math.cos(a) * r;
      const g = c.createLinearGradient(w / 2 - dx, h / 2 - dy, w / 2 + dx, h / 2 + dy); g.addColorStop(0, b.g1); g.addColorStop(1, b.g2);
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    } else {
      c.fillStyle = b.color; c.fillRect(0, 0, w, h);
      if (b.type === "image") {
        const im = imgEl.get(b.imgId);
        if (im) {
          const mg = b.blur * 3, s = Math.max((w + mg * 2) / im.width, (h + mg * 2) / im.height), dw = im.width * s, dh = im.height * s;
          const dx = (w + mg * 2 - dw) * b.px / 100 - mg, dy = (h + mg * 2 - dh) * b.py / 100 - mg;
          c.save(); if ("filter" in c) c.filter = `blur(${b.blur}px) brightness(${b.bright}%)`; c.drawImage(im, dx, dy, dw, dh); c.restore();
        }
      }
    }
    if (b.overlay > 0) { c.globalAlpha = b.overlay / 100; c.fillStyle = b.overlayColor; c.fillRect(0, 0, w, h); c.globalAlpha = 1; }
  }
  function drawEl(c, e) {
    const L = layout(e);
    c.save(); c.translate(e.x, e.y); c.rotate(e.rot * Math.PI / 180);
    c.font = fontStr(e); if ("letterSpacing" in c) c.letterSpacing = e.ls + "px"; c.textBaseline = "middle";
    if (e.bg) { c.fillStyle = e.bgColor; rr(c, -e.w / 2, -L.h / 2, e.w, L.h, e.fontSize * 0.25); c.fill(); }
    c.textAlign = e.align; const tx = e.align === "left" ? -e.w / 2 + L.pad : e.align === "right" ? e.w / 2 - L.pad : 0;
    L.lines.forEach((ln, i) => {
      const ty = -L.h / 2 + L.pad + (i + 0.5) * L.lh;
      if (e.outline > 0) { c.lineJoin = "round"; c.lineWidth = e.outline * 2; c.strokeStyle = e.outlineColor; c.strokeText(ln, tx, ty); }
      if (e.shadow) { c.shadowColor = "rgba(0,0,0,.55)"; c.shadowBlur = e.fontSize * 0.18; c.shadowOffsetY = e.fontSize * 0.05; }
      c.fillStyle = e.color; c.fillText(ln, tx, ty); c.shadowColor = "transparent";
    });
    c.restore();
  }
  function drawWm(c, st) {
    const wm = st.wm; if (!wm || !wm.on) return;
    const fs = Math.max(16, st.w * 0.026), m = fs, p = wm.pos;
    c.save(); c.globalAlpha = wm.opacity; c.font = `600 ${fs}px "Hind Siliguri", sans-serif`; c.fillStyle = "#fff"; c.shadowColor = "rgba(0,0,0,.6)"; c.shadowBlur = 4;
    c.textAlign = p[1] === "r" ? "right" : p[1] === "l" ? "left" : "center"; c.textBaseline = p[0] === "b" ? "bottom" : "top";
    c.fillText(cfg.SITE_NAME || "Limon Chacchu Caption Ghor", p[1] === "r" ? st.w - m : p[1] === "l" ? m : st.w / 2, p[0] === "b" ? st.h - m : m);
    c.restore();
  }
  const scaleK = () => S.w / (cv.getBoundingClientRect().width || S.w);
  function handles(e) {
    const L = layout(e), a = e.rot * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a), k = scaleK();
    const rt = (lx, ly) => ({ x: e.x + lx * cs - ly * sn, y: e.y + lx * sn + ly * cs });
    return { L, br: rt(e.w / 2, L.h / 2), ro: rt(0, -L.h / 2 - 34 * k), tl: rt(-e.w / 2, -L.h / 2), tr: rt(e.w / 2, -L.h / 2), bl: rt(-e.w / 2, L.h / 2) };
  }
  function drawUi(c) {
    const k = scaleK();
    if (drag && drag.mode === "move") {
      c.save(); c.strokeStyle = "#00e5ff"; c.lineWidth = 2 * k;
      if (guides.x) { c.beginPath(); c.moveTo(S.w / 2, 0); c.lineTo(S.w / 2, S.h); c.stroke(); }
      if (guides.y) { c.beginPath(); c.moveTo(0, S.h / 2); c.lineTo(S.w, S.h / 2); c.stroke(); }
      c.restore();
    }
    const e = cur(); if (!e) return;
    const H = handles(e);
    c.save(); c.strokeStyle = "#e8789f"; c.fillStyle = "#fff"; c.lineWidth = 2 * k; c.setLineDash([8 * k, 6 * k]);
    c.beginPath(); [H.tl, H.tr, H.br, H.bl].forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.closePath(); c.stroke(); c.setLineDash([]);
    const tm = { x: (H.tl.x + H.tr.x) / 2, y: (H.tl.y + H.tr.y) / 2 };
    c.beginPath(); c.moveTo(tm.x, tm.y); c.lineTo(H.ro.x, H.ro.y); c.stroke();
    [H.br, H.ro].forEach((p) => { c.beginPath(); c.arc(p.x, p.y, 11 * k, 0, 7); c.fill(); c.stroke(); });
    c.restore();
  }
  function draw(c, st, ui) { drawBg(c, st); st.els.forEach((e) => drawEl(c, e)); drawWm(c, st); if (ui) drawUi(c); }
  function render() { if (cv.width !== S.w || cv.height !== S.h) { cv.width = S.w; cv.height = S.h; } draw(ctx, S, true); }

  // ---------- assets ----------
  const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  async function loadFont(e) { try { await Promise.race([document.fonts.load(`${e.weight} 40px "${e.font}"`, e.text || "অ"), new Promise((r) => setTimeout(r, 3000))]); } catch {} }
  const ensureFonts = (st) => Promise.all(st.els.map(loadFont));
  document.fonts && document.fonts.addEventListener && document.fonts.addEventListener("loadingdone", () => S && render());
  async function setBgImage(data) {
    const id = ++imgSeq; imgStore.set(id, data); imgEl.set(id, await loadImg(data));
    S.bg.type = "image"; S.bg.imgId = id; commit(); render(); syncPanel();
  }
  async function prepState(st) {
    const t = JSON.parse(JSON.stringify(st));
    if (t.bg && t.bg.imgData) { const id = ++imgSeq; imgStore.set(id, t.bg.imgData); try { imgEl.set(id, await loadImg(t.bg.imgData)); t.bg.imgId = id; } catch { t.bg.type = "solid"; t.bg.imgId = null; } delete t.bg.imgData; }
    t.bg = Object.assign(defaultBg(), t.bg); t.wm = Object.assign(wmDefault(), t.wm || {});
    return t;
  }
  const serial = () => { const t = JSON.parse(snap()); if (t.bg.imgId != null) t.bg.imgData = imgStore.get(t.bg.imgId); delete t.bg.imgId; return t; };

  // ---------- history ----------
  function commit() { const s = snap(); if (s !== last) { undoSt.push(last); if (undoSt.length > 60) undoSt.shift(); redoSt.length = 0; last = s; } hist(); }
  let ct; const commitSoon = () => { clearTimeout(ct); ct = setTimeout(commit, 500); };
  function restore(s) { S = JSON.parse(s); last = s; if (selId && !cur()) selId = null; render(); syncPanel(); hist(); }
  function hist() { $("#undo").disabled = !undoSt.length; $("#redo").disabled = !redoSt.length; }
  $("#undo").onclick = () => { clearTimeout(ct); commit(); if (!undoSt.length) return; redoSt.push(last); restore(undoSt.pop()); };
  $("#redo").onclick = () => { if (!redoSt.length) return; undoSt.push(last); restore(redoSt.pop()); };

  // ---------- templates & size ----------
  async function applyTemplate(t) {
    const [w, h] = SIZES[t.sz]; const wm = S ? S.wm : wmDefault();
    S = { w, h, bg: Object.assign(defaultBg(), { type: "gradient", g1: t.g[0], g2: t.g[1] }), els: [], wm };
    const body = newEl({ text: userText || t.t, font: t.f, color: t.c, weight: t.wt || 600, fontSize: Math.round(w * (t.sz === "ls" ? 0.045 : 0.06)), w: w * 0.8 });
    if (t.top) S.els.push(newEl({ text: t.top, y: h * 0.25, font: "Galada", fontSize: Math.round(w * 0.08), color: t.c }));
    S.els.push(body); selId = body.id;
    await ensureFonts(S); commit(); render(); syncPanel(); syncSizeInputs();
  }
  async function changeSize(nw, nh) {
    nw = clamp(Math.round(nw) || 1080, 320, 4000); nh = clamp(Math.round(nh) || 1080, 320, 4000);
    const rx = nw / S.w, ry = nh / S.h;
    S.els.forEach((e) => { e.x *= rx; e.y *= ry; e.fontSize = Math.max(8, e.fontSize * rx); e.w *= rx; e.outline *= rx; });
    S.w = nw; S.h = nh; commit(); render(); syncSizeInputs();
  }
  const syncSizeInputs = () => { $("#cw").value = S.w; $("#ch").value = S.h; };
  $$("[data-size]").forEach((b) => (b.onclick = () => changeSize(...SIZES[b.dataset.size])));
  $("#cApply").onclick = () => changeSize(+$("#cw").value, +$("#ch").value);
  $("#tplGrid").replaceChildren(...TPL.map((t) => { const b = document.createElement("button"); b.className = "tpl"; b.textContent = t.n; b.style.background = `linear-gradient(135deg,${t.g[0]},${t.g[1]})`; b.onclick = () => applyTemplate(t); return b; }));

  // ---------- panel ----------
  FONTS.forEach((f) => { const o = document.createElement("option"); o.value = f; o.textContent = f; $("#fnt").appendChild(o); });
  $$(".tabs button").forEach((b) => (b.onclick = () => {
    $$(".tabs button").forEach((x) => x.setAttribute("aria-selected", x === b));
    $$(".tp").forEach((p) => (p.hidden = p.id !== "p-" + b.dataset.tab));
  }));
  const TXT = { tx: ["text", "s"], fnt: ["font", "s"], fs: ["fontSize", "n"], fw: ["weight", "n"], col: ["color", "s"], lh: ["lh", "n"], ls: ["ls", "n"], shd: ["shadow", "b"], olw: ["outline", "n"], olc: ["outlineColor", "s"], tbg: ["bg", "b"], tbc: ["bgColor", "s"], rot: ["rot", "n"] };
  Object.entries(TXT).forEach(([id, [prop, ty]]) => {
    const inp = $("#" + id);
    inp.addEventListener("input", async () => {
      const e = cur(); if (!e) return;
      e[prop] = ty === "b" ? inp.checked : ty === "n" ? parseFloat(inp.value) : inp.value;
      if (prop === "text" && inp.value.trim()) userText = inp.value;
      if (prop === "font" || prop === "weight") await loadFont(e);
      render(); commitSoon();
    });
    inp.addEventListener("change", commit);
  });
  $$("[data-al]").forEach((b) => (b.onclick = () => { const e = cur(); if (e) { e.align = b.dataset.al; commit(); render(); } }));
  $$("[data-ca]").forEach((b) => (b.onclick = () => {
    const e = cur(); if (!e) return; const L = layout(e), a = b.dataset.ca;
    if (a === "l") e.x = e.w / 2; if (a === "r") e.x = S.w - e.w / 2; if (a === "ch") e.x = S.w / 2;
    if (a === "t") e.y = L.h / 2; if (a === "b") e.y = S.h - L.h / 2; if (a === "cv") e.y = S.h / 2;
    commit(); render();
  }));
  function syncPanel() {
    const e = cur(); $("#fsText").disabled = !e; $("#noSel").hidden = !!e;
    if (e) Object.entries(TXT).forEach(([id, [prop, ty]]) => { const i = $("#" + id); if (ty === "b") i.checked = !!e[prop]; else i.value = e[prop]; });
    const b = S.bg;
    $("#bgType").value = b.type; $("#bgColor").value = b.color; $("#bgG1").value = b.g1; $("#bgG2").value = b.g2; $("#bgAng").value = b.angle;
    $("#bgBlur").value = b.blur; $("#bgBr").value = b.bright; $("#bgPx").value = b.px; $("#bgPy").value = b.py; $("#bgOv").value = b.overlay; $("#bgOvC").value = b.overlayColor;
    $("#g-solid").hidden = b.type !== "solid"; $("#g-grad").hidden = b.type !== "gradient"; $("#g-img").hidden = b.type !== "image"; $("#bgPresets").hidden = b.type === "image";
    $("#blurNote").hidden = "filter" in ctx;
    $("#wmOn").checked = S.wm.on; $("#wmPos").value = S.wm.pos; $("#wmOp").value = S.wm.opacity;
  }
  $("#addTxt").onclick = () => { const e = newEl({ text: "নতুন লেখা", y: S.h * 0.5 + S.els.length * S.h * 0.06 }); S.els.push(e); selId = e.id; commit(); render(); syncPanel(); $$(".tabs button")[1].click(); $("#tx").focus(); $("#tx").select(); };
  $("#dupTxt").onclick = () => { const e = cur(); if (!e) return; const c = Object.assign({}, e, { id: uid(), x: e.x + S.w * 0.03, y: e.y + S.w * 0.03 }); S.els.push(c); selId = c.id; commit(); render(); syncPanel(); };
  $("#delTxt").onclick = () => { const e = cur(); if (!e) return; S.els = S.els.filter((x) => x !== e); selId = null; commit(); render(); syncPanel(); };

  // background controls
  const BG = { bgType: ["type", "s"], bgColor: ["color", "s"], bgG1: ["g1", "s"], bgG2: ["g2", "s"], bgAng: ["angle", "n"], bgBlur: ["blur", "n"], bgBr: ["bright", "n"], bgPx: ["px", "n"], bgPy: ["py", "n"], bgOv: ["overlay", "n"], bgOvC: ["overlayColor", "s"] };
  Object.entries(BG).forEach(([id, [prop, ty]]) => {
    const i = $("#" + id);
    i.addEventListener("input", () => { S.bg[prop] = ty === "n" ? parseFloat(i.value) : i.value; if (id === "bgType") syncPanel(); render(); commitSoon(); });
    i.addEventListener("change", commit);
  });
  $("#bgPresets").replaceChildren(...BGS.map((g) => { const b = document.createElement("button"); b.className = "sw"; b.setAttribute("aria-label", "প্রিসেট ব্যাকগ্রাউন্ড"); b.style.background = `linear-gradient(135deg,${g[0]},${g[1]})`; b.onclick = () => { Object.assign(S.bg, { type: "gradient", g1: g[0], g2: g[1] }); commit(); render(); syncPanel(); }; return b; }));
  $("#bgFile").onchange = async (ev) => {
    const f = ev.target.files[0]; ev.target.value = ""; if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return toast("শুধু JPG, PNG বা WebP ছবি দেওয়া যাবে");
    if (f.size > 5 * 1024 * 1024) return toast("ছবি ৫MB এর বেশি হওয়া যাবে না");
    const url = URL.createObjectURL(f);
    try {
      const im = await loadImg(url), sc = Math.min(1, 1800 / Math.max(im.width, im.height)), c = document.createElement("canvas");
      c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc);
      const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
      await setBgImage(c.toDataURL("image/jpeg", 0.85));
    } catch { toast("ছবি লোড করা যায়নি"); } finally { URL.revokeObjectURL(url); }
  };
  $("#bgRm").onclick = () => { S.bg.type = "gradient"; S.bg.imgId = null; commit(); render(); syncPanel(); };

  // watermark
  [["wmOn", "on", "checked"], ["wmPos", "pos", "value"], ["wmOp", "opacity", "value"]].forEach(([id, p, a]) => {
    const i = $("#" + id);
    i.addEventListener("input", () => { S.wm[p] = a === "checked" ? i.checked : id === "wmOp" ? parseFloat(i.value) : i.value; render(); commitSoon(); });
  });

  // ---------- pointer interaction ----------
  const pt = (ev) => { const r = cv.getBoundingClientRect(); return { x: (ev.clientX - r.left) * S.w / r.width, y: (ev.clientY - r.top) * S.h / r.height }; };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function hitTest(p) {
    for (let i = S.els.length - 1; i >= 0; i--) {
      const e = S.els[i], L = layout(e), a = -e.rot * Math.PI / 180, dx = p.x - e.x, dy = p.y - e.y;
      const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
      if (Math.abs(lx) <= e.w / 2 && Math.abs(ly) <= L.h / 2) return e;
    }
    return null;
  }
  cv.addEventListener("pointerdown", (ev) => {
    const p = pt(ev), k = scaleK(), e0 = cur(); let mode = null, target = null;
    if (e0) { const H = handles(e0); if (dist(p, H.br) < 24 * k) { mode = "resize"; target = e0; } else if (dist(p, H.ro) < 24 * k) { mode = "rotate"; target = e0; } }
    if (!mode) { const hit = hitTest(p); selId = hit ? hit.id : null; if (hit) { mode = "move"; target = hit; } syncPanel(); }
    if (mode) drag = { mode, e: target, ox: p.x - target.x, oy: p.y - target.y, fs: target.fontSize, w: target.w, d0: Math.max(1, dist(p, target)) };
    if (drag) cv.setPointerCapture(ev.pointerId);
    ev.preventDefault(); render();
  });
  cv.addEventListener("pointermove", (ev) => {
    if (!drag) return; const p = pt(ev), e = drag.e, k = scaleK();
    if (drag.mode === "move") {
      e.x = p.x - drag.ox; e.y = p.y - drag.oy; guides = { x: false, y: false };
      if (Math.abs(e.x - S.w / 2) < 10 * k) { e.x = S.w / 2; guides.x = true; }
      if (Math.abs(e.y - S.h / 2) < 10 * k) { e.y = S.h / 2; guides.y = true; }
    } else if (drag.mode === "resize") {
      const r = dist(p, e) / drag.d0; e.fontSize = clamp(drag.fs * r, 8, 400); e.w = clamp(drag.w * r, 40, S.w * 3); $("#fs").value = Math.min(300, e.fontSize);
    } else {
      let a = Math.atan2(p.y - e.y, p.x - e.x) * 180 / Math.PI + 90; if (a > 180) a -= 360; if (Math.abs(a) < 4) a = 0; e.rot = Math.round(a); $("#rot").value = e.rot;
    }
    render();
  });
  const endDrag = () => { if (!drag) return; drag = null; guides = { x: false, y: false }; commit(); render(); syncPanel(); };
  cv.addEventListener("pointerup", endDrag); cv.addEventListener("pointercancel", endDrag);
  cv.addEventListener("dblclick", () => { if (cur()) { $$(".tabs button")[1].click(); $("#tx").focus(); } });
  cv.addEventListener("keydown", (ev) => {
    const e = cur(); if (!e) return; const st = ev.shiftKey ? 20 : 4; let used = true;
    if (ev.key === "ArrowLeft") e.x -= st; else if (ev.key === "ArrowRight") e.x += st; else if (ev.key === "ArrowUp") e.y -= st; else if (ev.key === "ArrowDown") e.y += st;
    else if (ev.key === "Delete" || ev.key === "Backspace") { S.els = S.els.filter((x) => x !== e); selId = null; syncPanel(); } else used = false;
    if (used) { ev.preventDefault(); render(); commitSoon(); }
  });
  document.addEventListener("keydown", (ev) => {
    if (/INPUT|TEXTAREA|SELECT/.test(ev.target.tagName)) return;
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z") { ev.preventDefault(); (ev.shiftKey ? $("#redo") : $("#undo")).click(); }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "y") { ev.preventDefault(); $("#redo").click(); }
  });
  $("#reset").onclick = () => { if (confirm("ডিজাইন রিসেট করবেন? আনডু দিয়ে ফেরানো যাবে।")) { curId = null; applyTemplate(TPL[0]); } };
  $("#themeBtn").onclick = () => { const n = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = n; try { localStorage.setItem("theme", n); } catch {} };

  // ---------- export ----------
  async function buildBlob(st, fmt, scale) {
    await ensureFonts(st);
    while (st.w * scale * st.h * scale > 16e6 && scale > 1) scale -= 0.5;
    const c = document.createElement("canvas"); c.width = Math.round(st.w * scale); c.height = Math.round(st.h * scale);
    const x = c.getContext("2d"); x.scale(scale, scale); draw(x, st, false);
    return new Promise((res) => c.toBlob(res, fmt === "jpg" ? "image/jpeg" : "image/png", 0.92));
  }
  const safeName = (n) => (n || "").replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "caption-design";
  let pBlob = null, pUrl = null;
  async function refreshPreview(st) {
    st = st || S; const b = await buildBlob(st, $("#pfmt").value, +$("#pscale").value);
    if (!b) return toast("এক্সপোর্ট করা যায়নি"); if (pUrl) URL.revokeObjectURL(pUrl);
    pBlob = b; pUrl = URL.createObjectURL(b); $("#prevImg").src = pUrl;
  }
  let prevState = null;
  async function openPreview(st) { prevState = st || null; $("#pname").value = safeName($("#dname").value || "caption-design"); $("#prevDlg").showModal(); await refreshPreview(prevState); }
  $("#dl").onclick = () => { clearTimeout(ct); commit(); openPreview(null); };
  $("#pfmt").onchange = $("#pscale").onchange = () => refreshPreview(prevState);
  $("#pdl").onclick = () => { if (!pBlob) return; const a = document.createElement("a"); a.href = pUrl; a.download = safeName($("#pname").value) + "." + ($("#pfmt").value === "jpg" ? "jpg" : "png"); document.body.appendChild(a); a.click(); a.remove(); };
  $("#pshare").onclick = async () => {
    if (!pBlob) return; const f = new File([pBlob], safeName($("#pname").value) + "." + ($("#pfmt").value === "jpg" ? "jpg" : "png"), { type: pBlob.type });
    if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], text: "আমার ডিজাইন" }); } catch {} } else toast("এই ডিভাইসে সরাসরি শেয়ার সমর্থিত নয়। আগে ডাউনলোড করে শেয়ার করুন।");
  };
  $("#pclose").onclick = () => $("#prevDlg").close();
  $("#prevDlg").addEventListener("close", () => { if (pUrl) { URL.revokeObjectURL(pUrl); pUrl = null; pBlob = null; } });

  // ---------- save / gallery ----------
  const readLocal = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
  const writeLocal = (l) => { try { localStorage.setItem(KEY, JSON.stringify(l)); return true; } catch { return false; } };
  function thumb(st) { const c = document.createElement("canvas"), s = 240 / Math.max(st.w, st.h); c.width = Math.round(st.w * s); c.height = Math.round(st.h * s); const x = c.getContext("2d"); x.scale(s, s); draw(x, st, false); return c.toDataURL("image/jpeg", 0.6); }
  async function saveDesign() {
    clearTimeout(ct); commit(); await ensureFonts(S);
    const rec = { id: curId || uuid(), name: $("#dname").value.trim() || "আমার ডিজাইন", updated: new Date().toISOString(), thumb: thumb(S), state: serial() };
    curId = rec.id; let msg = "সেভ হয়েছে ✓ (এই ডিভাইসে)";
    let list = readLocal().filter((d) => d.id !== rec.id); list.unshift(rec);
    if (!writeLocal(list.slice(0, 30))) {
      const lite = JSON.parse(JSON.stringify(rec)); delete lite.state.bg.imgData; if (lite.state.bg.type === "image") lite.state.bg.type = "gradient";
      list[0] = lite; msg = writeLocal(list.slice(0, 30)) ? "জায়গা কম, তাই ব্যাকগ্রাউন্ড ছবি ছাড়া সেভ হয়েছে" : "সেভ করা যায়নি (ব্রাউজারের স্টোরেজ ভর্তি)";
    }
    if (sb && user) {
      const data = { thumb: rec.thumb, state: JSON.parse(JSON.stringify(rec.state)) };
      if (JSON.stringify(data).length > 700000) { delete data.state.bg.imgData; if (data.state.bg.type === "image") data.state.bg.type = "gradient"; msg += "; অনলাইনে ছবি ছাড়া"; }
      const { error } = await sb.from("designs").upsert({ id: rec.id, user_id: user.id, name: rec.name, data, updated_at: rec.updated });
      msg = error ? msg + " (অনলাইন সেভ ব্যর্থ)" : "সেভ হয়েছে ✓ (অ্যাকাউন্টে)";
    } else if (!sb) msg += "। লগইন করলে অ্যাকাউন্টে সেভ হবে।";
    toast(msg);
  }
  $("#save").onclick = saveDesign;
  async function allDesigns() {
    const map = new Map(readLocal().map((d) => [d.id, d]));
    if (sb && user) {
      const { data } = await sb.from("designs").select("id,name,data,updated_at").order("updated_at", { ascending: false }).limit(50);
      (data || []).forEach((r) => { const o = map.get(r.id); if (!o || new Date(r.updated_at) > new Date(o.updated)) map.set(r.id, { id: r.id, name: r.name, updated: r.updated_at, thumb: r.data.thumb, state: r.data.state }); });
    }
    return [...map.values()].sort((a, b) => new Date(b.updated) - new Date(a.updated));
  }
  async function openGallery() {
    const box = $("#galList"); box.replaceChildren(); $("#galNote").textContent = sb && user ? "অ্যাকাউন্ট ও এই ডিভাইসের ডিজাইন" : "এই ডিভাইসের ডিজাইন (লগইন করলে অ্যাকাউন্টেও সেভ হবে)";
    $("#galDlg").showModal();
    const list = await allDesigns();
    if (!list.length) { box.textContent = "এখনো কোনো ডিজাইন সেভ করা হয়নি।"; return; }
    list.forEach((d) => {
      const g = document.createElement("div"); g.className = "g";
      const im = document.createElement("img"); im.alt = d.name; im.src = d.thumb || ""; const nm = document.createElement("strong"); nm.textContent = d.name;
      const acts = document.createElement("div"); acts.className = "acts";
      const mk = (t, fn) => { const b = document.createElement("button"); b.className = "ib"; b.textContent = t; b.onclick = fn; acts.appendChild(b); };
      mk("এডিট", async () => { S = await prepState(d.state); selId = null; curId = d.id; $("#dname").value = d.name; await ensureFonts(S); undoSt.length = redoSt.length = 0; last = snap(); render(); syncPanel(); syncSizeInputs(); hist(); $("#galDlg").close(); });
      mk("ডুপ্লিকেট", () => { const c = JSON.parse(JSON.stringify(d)); c.id = uuid(); c.name = d.name + " (কপি)"; c.updated = new Date().toISOString(); const l = readLocal(); l.unshift(c); writeLocal(l.slice(0, 30)); if (sb && user) sb.from("designs").upsert({ id: c.id, user_id: user.id, name: c.name, data: { thumb: c.thumb, state: c.state } }).then(() => {}, () => {}); openGallery(); });
      mk("ডাউনলোড", async () => { $("#galDlg").close(); await openPreview(await prepState(d.state)); });
      mk("মুছুন", async () => { if (!confirm("ডিজাইনটি মুছে ফেলবেন?")) return; writeLocal(readLocal().filter((x) => x.id !== d.id)); if (sb && user) await sb.from("designs").delete().eq("id", d.id); if (curId === d.id) curId = null; openGallery(); });
      g.append(im, nm, acts); box.appendChild(g);
    });
  }
  $("#gallery").onclick = openGallery; $("#galClose").onclick = () => $("#galDlg").close();

  // ---------- init ----------
  async function init() {
    if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase) {
      sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
      try { const { data } = await sb.auth.getSession(); user = data.session && data.session.user; } catch {}
      try { const { data } = await sb.from("site_settings").select("value").eq("key", "watermark").maybeSingle(); if (data && data.value) cfg.WATERMARK = Object.assign({}, cfg.WATERMARK, { enabled: data.value.enabled, position: data.value.position, opacity: data.value.opacity }); } catch {}
    }
    try { const t = sessionStorage.getItem("design_text"); if (t) { userText = t.slice(0, 800); sessionStorage.removeItem("design_text"); } } catch {}
    if (!userText) { const q = new URLSearchParams(location.search).get("text"); if (q) userText = q.slice(0, 800); }
    S = { w: 1080, h: 1080, bg: defaultBg(), els: [], wm: wmDefault() };
    await applyTemplate(TPL[0]); undoSt.length = 0; last = snap(); hist(); selId = null; render(); syncPanel();
  }
  init();
})();
