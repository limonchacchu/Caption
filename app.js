(function () {
  "use strict";
  const cfg = window.SITE_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };
  const CATS = { love:"ভালোবাসা", sad:"কষ্ট", attitude:"অ্যাটিটিউড", friendship:"বন্ধুত্ব", islamic:"ইসলামিক", motivational:"অনুপ্রেরণা", funny:"মজার", life:"জীবন" };
  const TYPES = { caption:"ক্যাপশন", shayari:"শায়েরি", poem:"কবিতা", story:"গল্প" };
  const PAGE = 12;
  const BASE = location.origin + location.pathname.replace(/[^/]*$/, ""); // works under /Caption/ too
  const st = { items: [], q: "", cat: "", type: "", sort: "latest", favOnly: false, page: 1 };
  let sb = null, user = null, engine = null, favs = new Set(store.get("favs", []));
  let authMode = "login";

  const toast = (m) => { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 2200); };
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

  // ---------- Theme ----------
  $("#themeBtn").onclick = () => {
    const n = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = n; try { localStorage.setItem("theme", n); } catch {}
  };

  // ---------- Data ----------
  async function load() {
    const list = $("#list"); list.replaceChildren(...Array.from({ length: 6 }, () => el("div", "skel")));
    if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase) {
      sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
      try {
        const { data, error } = await sb.from("contents").select("*").eq("status", "published").order("created_at", { ascending: false }).limit(500);
        if (error) throw error;
        st.items = data.map((r) => ({ ...r, tags: r.tags || [] }));
      } catch (e) {
        console.error(e);
        st.items = window.SAMPLE_ITEMS || [];
        toast("সার্ভার সংযোগ ব্যর্থ, নমুনা কনটেন্ট দেখানো হচ্ছে");
      }
      initAuth();
      sb.from("site_settings").select("value").eq("key", "social").maybeSingle().then(({ data }) => {
        if (data && Array.isArray(data.value) && data.value.length) renderSocial(data.value.filter((x) => x.enabled !== false).sort((a, b) => (a.order || 0) - (b.order || 0)));
      }, () => {});
    } else {
      st.items = window.SAMPLE_ITEMS || [];
      $("#authBtn").hidden = true; $("#nAuth").hidden = true;
    }
    engine = CaptionSearch.create(st.items.map((i) => ({ ...i, category: CATS[i.category] || i.category })));
    renderDaily(); renderCats(); render();
  }

  // ---------- Ranking ----------
  function trending(i) {
    const age = (Date.now() - new Date(i.created_at).getTime()) / 864e5;
    return ((i.views || 0) + (i.copies || 0) * 3 + (i.shares || 0) * 4 + (i.likes || 0) * 2) / (1 + age / 7);
  }
  function filtered() {
    let r = st.q ? engine.search(st.q, 100).map((x) => st.items.find((i) => i.id === x.id)).filter(Boolean) : st.items.slice();
    if (st.cat) r = r.filter((i) => i.category === st.cat);
    if (st.type) r = r.filter((i) => i.type === st.type);
    if (st.favOnly) r = r.filter((i) => favs.has(String(i.id)));
    if (!st.q) {
      const s = st.sort;
      r.sort((a, b) => s === "trending" ? trending(b) - trending(a) : s === "latest" ? new Date(b.created_at) - new Date(a.created_at) : (b[s] || 0) - (a[s] || 0));
    }
    return r;
  }

  // ---------- Render ----------
  function card(i) {
    const c = el("article", "card");
    c.appendChild(el("p", "", i.body));
    const m = el("div", "meta");
    m.appendChild(el("span", "tag", TYPES[i.type] || i.type));
    m.appendChild(el("span", "tag", CATS[i.category] || i.category));
    (i.tags || []).slice(0, 2).forEach((t) => m.appendChild(el("span", "tag", "#" + t)));
    m.appendChild(el("span", "", "👁 " + (i.views || 0) + " · 📋 " + (i.copies || 0)));
    c.appendChild(m);
    const a = el("div", "acts");
    const cp = el("button", "ib", "কপি"); cp.onclick = () => copy(i);
    const sh = el("button", "ib", "শেয়ার"); sh.onclick = () => share(i);
    const fv = el("button", "ib fav", "❤"); fv.setAttribute("aria-pressed", favs.has(String(i.id)));
    fv.setAttribute("aria-label", "পছন্দ"); fv.onclick = () => { toggleFav(i); fv.setAttribute("aria-pressed", favs.has(String(i.id))); };
    const ds = el("button", "ib", "🎨"); ds.setAttribute("aria-label", "ডিজাইন করুন"); ds.title = "Design This Caption";
    ds.onclick = () => { try { sessionStorage.setItem("design_text", i.body); } catch {} location.href = "design.html"; };
    a.append(cp, sh, ds, fv); c.appendChild(a);
    return c;
  }
  function render() {
    const r = filtered(), list = $("#list");
    $("#clr").hidden = !st.q;
    $("#rtitle").textContent = st.favOnly ? "আমার পছন্দ" : st.q ? `"${st.q}" এর ফলাফল (${r.length})` : "সব কনটেন্ট";
    list.replaceChildren();
    if (!r.length) {
      const e = el("div", "empty", st.favOnly ? "এখনো কিছু পছন্দ করা হয়নি।" : "কিছু পাওয়া যায়নি। অন্য শব্দ বা ক্যাটাগরি চেষ্টা করুন।");
      e.style.gridColumn = "1/-1"; list.appendChild(e); $("#more").hidden = true; return;
    }
    r.slice(0, st.page * PAGE).forEach((i) => list.appendChild(card(i)));
    $("#more").hidden = r.length <= st.page * PAGE;
  }
  function renderCats() {
    const box = $("#cats"); box.replaceChildren();
    [["", "সব"], ...Object.entries(CATS)].forEach(([k, v]) => {
      const b = el("button", "chip", v); b.setAttribute("aria-pressed", st.cat === k);
      b.onclick = () => { st.cat = k; st.page = 1; renderCats(); render(); }; box.appendChild(b);
    });
  }
  function renderDaily() {
    const pool = st.items.filter((i) => i.type === "caption" || i.type === "shayari");
    const box = $("#dailyBox"); if (!pool.length) { box.hidden = true; return; }
    const day = Math.floor(Date.now() / 864e5);
    const i = pool[day % pool.length];
    box.replaceChildren(el("strong", "", "✨ আজকের কোট"), el("blockquote", "", i.body));
    const row = el("div", "acts");
    const c = el("button", "btn", "কপি"); c.onclick = () => copy(i);
    const s = el("button", "btn", "শেয়ার"); s.onclick = () => share(i);
    row.append(c, s); box.appendChild(row);
  }

  // ---------- Actions ----------
  const bump = (i, f) => { i[f] = (i[f] || 0) + 1; if (sb && !String(i.id).startsWith("s")) sb.rpc("bump_stat", { p_id: i.id, p_field: f }).then(() => {}, () => {}); };
  async function writeClip(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch {
      const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select();
      let ok = false; try { ok = document.execCommand("copy"); } catch {} t.remove(); return ok;
    }
  }
  async function copy(i) { (await writeClip(i.body)) ? (toast("কপি হয়েছে ✓"), bump(i, "copies")) : toast("কপি করা যায়নি"); }
  function toggleFav(i) {
    const id = String(i.id);
    if (favs.has(id)) favs.delete(id); else { favs.add(id); bump(i, "likes"); }
    store.set("favs", [...favs]);
    if (sb && user && !id.startsWith("s")) {
      const q = favs.has(id) ? sb.from("favorites").upsert({ user_id: user.id, content_id: i.id }) : sb.from("favorites").delete().eq("user_id", user.id).eq("content_id", i.id);
      q.then(() => {}, () => {});
    }
    if (st.favOnly) render();
  }
  function share(i) {
    const url = BASE;
    const text = `এই সুন্দর লেখাটি দেখুন —\n${i.body}`;
    $("#shareText").value = text;
    const enc = encodeURIComponent, links = $("#shareLinks"); links.replaceChildren();
    const mk = (n, h) => { const a = el("a", "btn alt", n); a.href = h; a.target = "_blank"; a.rel = "noopener noreferrer"; links.appendChild(a); a.onclick = () => bump(i, "shares"); };
    mk("WhatsApp", "https://wa.me/?text=" + enc(text + "\n" + url));
    mk("Facebook", "https://www.facebook.com/sharer/sharer.php?u=" + enc(url) + "&quote=" + enc(text));
    mk("Telegram", "https://t.me/share/url?url=" + enc(url) + "&text=" + enc(text));
    mk("X", "https://twitter.com/intent/tweet?text=" + enc(text) + "&url=" + enc(url));
    if (navigator.share) { navigator.share({ text, url }).then(() => bump(i, "shares")).catch(() => $("#shareDlg").showModal()); } else $("#shareDlg").showModal();
  }
  $("#shareCopy").onclick = async () => { (await writeClip($("#shareText").value)) ? toast("কপি হয়েছে ✓") : toast("কপি ব্যর্থ"); };
  $("#shareClose").onclick = () => $("#shareDlg").close();

  // ---------- Search UI ----------
  const onType = CaptionSearch.debounce(() => { st.q = $("#q").value.trim(); st.page = 1; render(); suggest(); }, 250);
  $("#q").addEventListener("input", onType);
  $("#q").addEventListener("keydown", (e) => { if (e.key === "Enter") { saveRecent(st.q); $("#sugg").hidden = true; } if (e.key === "Escape") $("#sugg").hidden = true; });
  $("#clr").onclick = () => { $("#q").value = ""; st.q = ""; $("#sugg").hidden = true; render(); $("#q").focus(); };
  $("#q").addEventListener("focus", suggest);
  document.addEventListener("click", (e) => { if (!e.target.closest(".sbox")) $("#sugg").hidden = true; });
  function saveRecent(q) { if (!q) return; const r = [q, ...store.get("recent", []).filter((x) => x !== q)].slice(0, 6); store.set("recent", r); }
  function suggest() {
    const box = $("#sugg"), q = $("#q").value.trim(); box.replaceChildren();
    const opts = q ? engine.search(q, 4).map((i) => i.body.split("\n")[0].slice(0, 40)) : store.get("recent", []);
    if (!opts.length) { box.hidden = true; return; }
    opts.forEach((o) => { const b = el("button", "", (q ? "🔍 " : "🕘 ") + o); b.onclick = () => { $("#q").value = o; st.q = o; saveRecent(o); box.hidden = true; render(); }; box.appendChild(b); });
    box.hidden = false;
  }
  // Voice search (only where the browser supports it; browser asks mic permission)
  $("#mic").onclick = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return toast("এই ব্রাউজারে ভয়েস সার্চ সমর্থিত নয়");
    const r = new SR(); r.lang = "bn-BD"; r.interimResults = false;
    r.onresult = (e) => { $("#q").value = e.results[0][0].transcript; onType(); };
    r.onerror = () => toast("ভয়েস ইনপুট ব্যর্থ বা অনুমতি দেওয়া হয়নি");
    try { r.start(); toast("বলুন…"); } catch {}
  };
  $("#type").onchange = (e) => { st.type = e.target.value; st.page = 1; render(); };
  $("#sort").onchange = (e) => { st.sort = e.target.value; st.page = 1; render(); };
  $("#more").onclick = () => { st.page++; render(); };
  $("#fav").onclick = $("#nFav").onclick = () => { st.favOnly = !st.favOnly; $("#fav").setAttribute("aria-pressed", st.favOnly); st.page = 1; render(); location.hash = "top"; };
  $("#nSearch").onclick = () => { scrollTo({ top: 0 }); $("#q").focus(); };
  $("#rnd").onclick = () => { const r = st.items; if (!r.length) return; const i = r[Math.floor(Math.random() * r.length)]; st.q = ""; $("#q").value = ""; $("#list").replaceChildren(card(i)); $("#rtitle").textContent = "র‍্যান্ডম কনটেন্ট"; $("#more").hidden = true; bump(i, "views"); };

  // ---------- Auth (Supabase) ----------
  function initAuth() {
    sb.auth.getSession().then(({ data }) => setUser(data.session && data.session.user));
    sb.auth.onAuthStateChange((_e, s) => setUser(s && s.user));
  }
  async function setUser(u) {
    user = u || null;
    $("#authBtn").textContent = user ? "লগআউট" : "লগইন";
    if (user && sb) {
      try {
        const { data } = await sb.from("favorites").select("content_id").eq("user_id", user.id);
        if (data) { data.forEach((r) => favs.add(String(r.content_id))); store.set("favs", [...favs]); render(); }
      } catch {}
    }
  }
  const openAuth = () => { if (user) { sb.auth.signOut(); toast("লগআউট হয়েছে"); } else $("#authDlg").showModal(); };
  $("#authBtn").onclick = $("#nAuth").onclick = openAuth;
  $("#authClose").onclick = () => $("#authDlg").close();
  $("#authSwitch").onclick = () => {
    authMode = authMode === "login" ? "signup" : "login";
    $("#authTitle").textContent = authMode === "login" ? "লগইন" : "নতুন অ্যাকাউন্ট";
    $("#authGo").textContent = authMode === "login" ? "লগইন" : "রেজিস্টার";
    $("#authSwitch").textContent = authMode === "login" ? "নতুন অ্যাকাউন্ট" : "লগইনে ফিরুন";
  };
  $("#authGo").onclick = async () => {
    const email = $("#em").value.trim(), password = $("#pw").value, msg = $("#authMsg");
    if (!email || password.length < 8) return (msg.textContent = "সঠিক ইমেইল ও কমপক্ষে ৮ অক্ষরের পাসওয়ার্ড দিন।");
    msg.textContent = "অপেক্ষা করুন…";
    const { error } = authMode === "login" ? await sb.auth.signInWithPassword({ email, password }) : await sb.auth.signUp({ email, password, options: { emailRedirectTo: BASE } });
    if (error) msg.textContent = "ব্যর্থ: " + error.message;
    else if (authMode === "signup") msg.textContent = "ইমেইল ভেরিফিকেশন লিংক পাঠানো হয়েছে। ইনবক্স চেক করুন।";
    else { msg.textContent = ""; $("#authDlg").close(); toast("লগইন সফল ✓"); }
  };
  $("#gBtn").onclick = () => sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: BASE } });
  $("#forgot").onclick = async () => {
    const email = $("#em").value.trim(); if (!email) return ($("#authMsg").textContent = "প্রথমে ইমেইল লিখুন।");
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: BASE });
    $("#authMsg").textContent = error ? "ব্যর্থ: " + error.message : "রিসেট লিংক পাঠানো হয়েছে।";
  };

  // ---------- Social links (admin-managed, with config fallback; only valid https URLs) ----------
  const names = { facebook: "Facebook", youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok", telegram: "Telegram", whatsapp: "WhatsApp", pinterest: "Pinterest", x: "X" };
  function renderSocial(items) {
    const box = $("#social"); box.replaceChildren();
    items.forEach(({ name, url }) => {
      try { const u = new URL(url); if (u.protocol !== "https:") return;
        const a = el("a", "", name); a.href = u.href; a.target = "_blank"; a.rel = "noopener noreferrer"; a.setAttribute("aria-label", name + " এ যান"); box.appendChild(a);
      } catch {}
    });
  }
  renderSocial(Object.entries(cfg.SOCIAL || {}).filter(([, u]) => u).map(([k, u]) => ({ name: names[k] || k, url: u })));

  $("#yr").textContent = new Date().getFullYear();
  load();
})();
