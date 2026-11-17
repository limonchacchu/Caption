(function () {
  "use strict";
  const cfg = window.SITE_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  const CATS = { love: "ভালোবাসা", sad: "কষ্ট", attitude: "অ্যাটিটিউড", friendship: "বন্ধুত্ব", islamic: "ইসলামিক", motivational: "অনুপ্রেরণা", funny: "মজার", life: "জীবন" };
  const TYPES = { caption: "ক্যাপশন", shayari: "শায়েরি", poem: "কবিতা", story: "গল্প", rhymes: "ছন্দ", quote: "কোট" };
  const STATUS = { draft: "ড্রাফট", pending: "পেন্ডিং", published: "প্রকাশিত", rejected: "বাতিল" };
  const ROLES = { user: "ইউজার", moderator: "মডারেটর", admin: "অ্যাডমিন" };
  const PLATFORMS = ["facebook", "youtube", "instagram", "tiktok", "telegram", "whatsapp", "pinterest", "x", "custom"];
  const PER = 15;
  let sb, me, profile;

  // ---------- helpers ----------
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") e.className = v;
      else if (k === "value") e.value = v;
      else if (k === "checked") e.checked = !!v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, "");
      else if (v !== false && v != null) e.setAttribute(k, v);
    }
    kids.flat(Infinity).forEach((c) => { if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c))); });
    return e;
  }
  const rc = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter((c) => c != null && c !== false).map((c) => (c.nodeType ? c : document.createTextNode(String(c)))));
  const toast = (m) => { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 2800); };
  const isAdmin = () => profile && profile.role === "admin";
  const fmt = (d) => new Date(d).toLocaleString("bn-BD", { dateStyle: "medium", timeStyle: "short" });
  const errMsg = (e) => (e && e.message) || "অজানা ত্রুটি";
  const opts = (map, withAll) => [withAll ? h("option", { value: "" }, withAll) : null, ...Object.entries(map).map(([k, v]) => h("option", { value: k }, v))];
  const safeQ = (s) => s.replace(/[,()%*\\]/g, " ").trim();
  $("#themeBtn").onclick = () => { const n = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = n; try { localStorage.setItem("theme", n); } catch {} };

  // ---------- gate: login / MFA / access ----------
  const gate = $("#gate");
  const gateShow = (...n) => { gate.hidden = false; $("#app").hidden = true; rc(gate, ...n); };
  const gateMsg = (t) => gateShow(h("div", { class: "box" }, h("p", null, t)));
  async function boot() {
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || !window.supabase) return gateMsg("Supabase কনফিগার করা নেই। assets/js/config.js-এ URL ও anon key দিন।");
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    const { data } = await sb.auth.getSession();
    if (!data.session) return showLogin();
    me = data.session.user; afterLogin();
  }
  function showLogin(msg) {
    const em = h("input", { type: "email", placeholder: "ইমেইল", autocomplete: "email", required: true });
    const pw = h("input", { type: "password", placeholder: "পাসওয়ার্ড", autocomplete: "current-password", required: true });
    const note = h("p", { class: "meta", role: "status" }, msg || "");
    const f = h("form", null, h("h2", null, "অ্যাডমিন লগইন"), em, pw, note, h("button", { class: "btn", type: "submit" }, "লগইন"));
    f.onsubmit = async (e) => {
      e.preventDefault(); note.textContent = "অপেক্ষা করুন…";
      const { data, error } = await sb.auth.signInWithPassword({ email: em.value.trim(), password: pw.value });
      if (error) { note.textContent = "লগইন ব্যর্থ: ইমেইল বা পাসওয়ার্ড ভুল হতে পারে।"; return; }
      me = data.user; afterLogin();
    };
    gateShow(f);
  }
  async function afterLogin() {
    const { data: a } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (a && a.nextLevel === "aal2" && a.currentLevel !== "aal2") return showMfa();
    const { data: p, error } = await sb.from("profiles").select("role,is_suspended,display_name").eq("id", me.id).maybeSingle();
    if (error || !p || p.is_suspended || !["admin", "moderator"].includes(p.role)) {
      return gateShow(h("div", { class: "box" }, h("h2", null, "অনুমতি নেই"), h("p", null, "এই অ্যাকাউন্টের অ্যাডমিন বা মডারেটর অধিকার নেই।"), h("button", { class: "btn", onclick: logout }, "লগআউট")));
    }
    profile = p; startApp();
  }
  async function showMfa() {
    const { data } = await sb.auth.mfa.listFactors();
    const f = ((data && data.totp) || []).find((x) => x.status === "verified");
    if (!f) return showLogin("MFA ফ্যাক্টর পাওয়া যায়নি।");
    const code = h("input", { type: "text", inputmode: "numeric", autocomplete: "one-time-code", maxlength: "6", placeholder: "৬ সংখ্যার কোড" });
    const note = h("p", { class: "meta", role: "status" });
    const form = h("form", null, h("h2", null, "MFA কোড"), h("p", null, "অথেন্টিকেটর অ্যাপের কোড দিন।"), code, note, h("button", { class: "btn", type: "submit" }, "যাচাই করুন"));
    form.onsubmit = async (e) => {
      e.preventDefault();
      const ch = await sb.auth.mfa.challenge({ factorId: f.id });
      if (ch.error) { note.textContent = "ব্যর্থ, আবার চেষ্টা করুন।"; return; }
      const v = await sb.auth.mfa.verify({ factorId: f.id, challengeId: ch.data.id, code: code.value.trim() });
      if (v.error) { note.textContent = "কোড ভুল।"; return; }
      afterLogin();
    };
    gateShow(form);
  }
  async function logout() { await sb.auth.signOut(); location.reload(); }
  $("#logout").onclick = logout;

  // ---------- app shell ----------
  const VIEWS = {
    overview: ["📊 ওভারভিউ", vOverview, false], content: ["📝 কনটেন্ট", vContent, false], submissions: ["📥 সাবমিশন", vSubs, false],
    users: ["👥 ইউজার", vUsers, true], social: ["🔗 সোশ্যাল লিংক", vSocial, true], settings: ["⚙️ সেটিংস", vSettings, true], audit: ["🛡 অডিট লগ", vAudit, true]
  };
  function startApp() {
    gate.hidden = true; $("#app").hidden = false; $("#logout").hidden = false;
    $("#who").textContent = `${profile.display_name || "ইউজার"} · ${ROLES[profile.role]}`;
    const nav = $("#nav"); rc(nav, );
    Object.entries(VIEWS).forEach(([k, [label, , adm]]) => { if (adm && !isAdmin()) return; nav.appendChild(h("button", { "data-v": k, onclick: () => go(k) }, label)); });
    go("overview");
  }
  async function go(k) {
    document.querySelectorAll("#nav button").forEach((b) => (b.dataset.v === k ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current")));
    const box = $("#view"); rc(box, h("p", { class: "meta" }, "লোড হচ্ছে…"));
    try { await VIEWS[k][1](box); } catch (e) { console.error(e); rc(box, h("div", { class: "alert bad" }, "লোড করা যায়নি: " + errMsg(e))); }
  }
  const must = (r) => { if (r.error) throw r.error; return r; };

  // ---------- overview ----------
  async function vOverview(box) {
    const cnt = (t, f) => { let q = sb.from(t).select("*", { count: "exact", head: true }); if (f) q = f(q); return q.then((r) => must(r).count || 0); };
    const [pub, pen, dra, rej, fea, usr, sus, top, mfa] = await Promise.all([
      cnt("contents", (q) => q.eq("status", "published")), cnt("contents", (q) => q.eq("status", "pending")), cnt("contents", (q) => q.eq("status", "draft")), cnt("contents", (q) => q.eq("status", "rejected")),
      cnt("contents", (q) => q.eq("featured", true)), cnt("profiles"), cnt("profiles", (q) => q.eq("is_suspended", true)),
      sb.from("contents").select("id,title,body,views,copies,shares,likes").eq("status", "published").order("views", { ascending: false }).limit(5).then((r) => must(r).data || []),
      sb.auth.mfa.listFactors().then((r) => !!(r.data && r.data.totp.some((x) => x.status === "verified")))
    ]);
    const st = (n, l) => h("div", { class: "stat" }, h("b", null, n), h("span", null, l));
    rc(box, h("h2", null, "ওভারভিউ"),
      !mfa ? h("div", { class: "alert" }, "⚠ আপনার অ্যাকাউন্টে MFA চালু নেই। সেটিংস থেকে চালু করুন।") : null,
      pen ? h("div", { class: "alert" }, `📥 ${pen}টি সাবমিশন রিভিউয়ের অপেক্ষায়। `, h("button", { class: "ib mini", onclick: () => go("submissions") }, "দেখুন")) : null,
      h("div", { class: "cards" }, st(pub, "প্রকাশিত"), st(pen, "পেন্ডিং"), st(dra, "ড্রাফট"), st(rej, "বাতিল"), st(fea, "ফিচার্ড"), st(usr, "মোট ইউজার"), st(sus, "সাসপেন্ড")),
      h("h3", null, "সবচেয়ে বেশি দেখা (৫টি)"),
      top.length ? h("div", { class: "tw" }, h("table", null, h("thead", null, h("tr", null, ["কনটেন্ট", "👁", "📋", "↗", "❤"].map((x) => h("th", null, x)))),
        h("tbody", null, top.map((c) => h("tr", null, h("td", null, h("div", { class: "t" }, c.title || c.body)), h("td", null, c.views), h("td", null, c.copies), h("td", null, c.shares), h("td", null, c.likes))))))
        : h("p", { class: "meta" }, "এখনো কোনো প্রকাশিত কনটেন্ট নেই।"));
  }

  // ---------- content ----------
  const cs = { page: 0, q: "", status: "", type: "", cat: "" }; const selected = new Set();
  async function vContent(box) {
    const search = h("input", { type: "search", placeholder: "খুঁজুন…", value: cs.q, "aria-label": "খুঁজুন" });
    const fs = h("select", { "aria-label": "স্ট্যাটাস" }, opts(STATUS, "সব স্ট্যাটাস")); fs.value = cs.status;
    const ft = h("select", { "aria-label": "ধরন" }, opts(TYPES, "সব ধরন")); ft.value = cs.type;
    const fc = h("select", { "aria-label": "ক্যাটাগরি" }, opts(CATS, "সব ক্যাটাগরি")); fc.value = cs.cat;
    const list = h("div"); const apply = () => { cs.q = search.value; cs.status = fs.value; cs.type = ft.value; cs.cat = fc.value; cs.page = 0; selected.clear(); load(); };
    search.onchange = fs.onchange = ft.onchange = fc.onchange = apply;
    const bulk = (label, fn, adm) => (adm && !isAdmin() ? null : h("button", { class: "ib mini", onclick: fn }, label));
    const importBtn = window.SAMPLE_ITEMS ? h("button", { class: "ib mini", onclick: importSample }, "নমুনা কনটেন্ট ইম্পোর্ট") : null;
    rc(box, h("h2", null, "কনটেন্ট ম্যানেজমেন্ট"),
      h("div", { class: "filters" }, h("button", { class: "btn", onclick: () => edit() }, "+ নতুন কনটেন্ট"), importBtn),
      h("div", { class: "filters" }, search, fs, ft, fc),
      h("div", { class: "filters" }, bulk("✔ প্রকাশ (নির্বাচিত)", () => bulkSet("published")), bulk("⏸ আনপাবলিশ", () => bulkSet("draft")), bulk("🗑 মুছুন (নির্বাচিত)", bulkDel, true)), list);
    async function load() {
      rc(list, h("p", { class: "meta" }, "লোড হচ্ছে…"));
      let q = sb.from("contents").select("id,title,body,type,category,tags,language,status,featured,admin_feedback,views,copies,shares,likes,created_at", { count: "exact" }).order("created_at", { ascending: false }).range(cs.page * PER, cs.page * PER + PER - 1);
      if (cs.status) q = q.eq("status", cs.status); if (cs.type) q = q.eq("type", cs.type); if (cs.cat) q = q.eq("category", cs.cat);
      const s = safeQ(cs.q); if (s) q = q.or(`title.ilike.%${s}%,body.ilike.%${s}%`);
      const r = must(await q), rows = r.data || [], total = r.count || 0, pages = Math.max(1, Math.ceil(total / PER));
      if (!rows.length) return rc(list, h("div", { class: "empty" }, "কোনো কনটেন্ট পাওয়া যায়নি।"));
      const all = h("input", { type: "checkbox", "aria-label": "সব নির্বাচন", onchange: (e) => { rows.forEach((x) => (e.target.checked ? selected.add(x.id) : selected.delete(x.id))); list.querySelectorAll("tbody input[type=checkbox]").forEach((c) => (c.checked = e.target.checked)); } });
      rc(list, 
        h("div", { class: "tw" }, h("table", null, h("thead", null, h("tr", null, h("th", null, all), ["কনটেন্ট", "ধরন/ক্যাটাগরি", "স্ট্যাটাস", "পরিসংখ্যান", "অ্যাকশন"].map((x) => h("th", null, x)))),
          h("tbody", null, rows.map((c) => h("tr", null,
            h("td", null, h("input", { type: "checkbox", "aria-label": "নির্বাচন", checked: selected.has(c.id), onchange: (e) => (e.target.checked ? selected.add(c.id) : selected.delete(c.id)) })),
            h("td", null, h("div", { class: "t" }, (c.featured ? "⭐ " : "") + (c.title || c.body))),
            h("td", null, `${TYPES[c.type] || c.type} / ${CATS[c.category] || c.category}`),
            h("td", null, h("span", { class: "badge " + c.status }, STATUS[c.status] || c.status)),
            h("td", null, `👁${c.views} 📋${c.copies} ↗${c.shares} ❤${c.likes}`),
            h("td", null, h("div", { class: "filters" },
              h("button", { class: "ib mini", onclick: () => edit(c) }, "এডিট"),
              h("button", { class: "ib mini", onclick: () => setStatus([c.id], c.status === "published" ? "draft" : "published") }, c.status === "published" ? "আনপাবলিশ" : "প্রকাশ"),
              h("button", { class: "ib mini", onclick: () => toggleFeat(c) }, c.featured ? "ফিচার বাদ" : "ফিচার্ড"),
              isAdmin() ? h("button", { class: "ib mini", onclick: () => del([c.id]) }, "মুছুন") : null))))))),
        h("div", { class: "pager" }, h("button", { class: "ib mini", disabled: cs.page === 0, onclick: () => { cs.page--; load(); } }, "← আগের"), `${cs.page + 1} / ${pages} (মোট ${total})`, h("button", { class: "ib mini", disabled: cs.page + 1 >= pages, onclick: () => { cs.page++; load(); } }, "পরের →")));
    }
    box._reload = load; load();
  }
  const reload = () => { const b = $("#view"); b._reload ? b._reload() : go("content"); };
  async function setStatus(ids, status) {
    if (!ids.length) return toast("কিছু নির্বাচন করা হয়নি");
    const r = await sb.from("contents").update({ status }).in("id", ids);
    r.error ? toast("ব্যর্থ: " + errMsg(r.error)) : (toast("আপডেট হয়েছে ✓"), reload());
  }
  const bulkSet = (s) => { if (!selected.size) return toast("আগে কনটেন্ট নির্বাচন করুন"); if (confirm(`${selected.size}টি কনটেন্টের স্ট্যাটাস বদলাবেন?`)) setStatus([...selected], s).then(() => selected.clear()); };
  const bulkDel = () => { if (!selected.size) return toast("আগে কনটেন্ট নির্বাচন করুন"); del([...selected]); };
  async function del(ids) {
    if (!isAdmin()) return toast("শুধু অ্যাডমিন মুছতে পারবেন");
    if (!confirm(`${ids.length}টি কনটেন্ট স্থায়ীভাবে মুছে যাবে। নিশ্চিত?`)) return;
    const r = await sb.from("contents").delete().in("id", ids);
    r.error ? toast("ব্যর্থ: " + errMsg(r.error)) : (selected.clear(), toast("মুছে ফেলা হয়েছে"), reload());
  }
  async function toggleFeat(c) { const r = await sb.from("contents").update({ featured: !c.featured }).eq("id", c.id); r.error ? toast("ব্যর্থ: " + errMsg(r.error)) : reload(); }
  async function importSample() {
    if (!confirm("নমুনা কনটেন্ট প্রকাশিত অবস্থায় যোগ হবে। এগিয়ে যাবেন?")) return;
    const rows = window.SAMPLE_ITEMS.map((i) => ({ title: i.title, body: i.body, type: i.type, category: i.category, tags: i.tags, status: "published", author_id: me.id }));
    const r = await sb.from("contents").insert(rows); r.error ? toast("ব্যর্থ: " + errMsg(r.error)) : (toast(`${rows.length}টি যোগ হয়েছে ✓`), reload());
  }
  function edit(c) {
    c = c || { title: "", body: "", type: "caption", category: "love", tags: [], language: "bn", status: "published", featured: false, admin_feedback: "" };
    const dlg = $("#edDlg"); dlg.className = "big";
    const title = h("input", { type: "text", maxlength: "120", value: c.title }), body = h("textarea", { rows: "6", maxlength: "5000" }, c.body);
    const type = h("select", null, opts(TYPES)), cat = h("select", null, opts(CATS)), st = h("select", null, opts(STATUS));
    type.value = c.type; cat.value = c.category; st.value = c.status;
    const tags = h("input", { type: "text", value: (c.tags || []).join(", "), placeholder: "কমা দিয়ে আলাদা করুন" });
    const lang = h("select", null, h("option", { value: "bn" }, "বাংলা"), h("option", { value: "en" }, "English"), h("option", { value: "hi" }, "हिन्दी"), h("option", { value: "ar" }, "العربية")); lang.value = c.language || "bn";
    const feat = h("input", { type: "checkbox", checked: c.featured }), fb = h("input", { type: "text", maxlength: "300", value: c.admin_feedback || "" });
    const msg = h("p", { class: "meta", role: "status" });
    const f = h("form", { class: "form" }, h("h3", null, c.id ? "কনটেন্ট এডিট" : "নতুন কনটেন্ট"),
      h("label", null, "শিরোনাম", title), h("label", null, "কনটেন্ট *", body),
      h("div", { class: "two" }, h("label", null, "ধরন", type), h("label", null, "ক্যাটাগরি", cat)),
      h("div", { class: "two" }, h("label", null, "স্ট্যাটাস", st), h("label", null, "ভাষা", lang)),
      h("label", null, "ট্যাগ", tags), h("label", { class: "chk" }, feat, "ফিচার্ড"), h("label", null, "অ্যাডমিন ফিডব্যাক (ইউজারকে দেখানো যাবে)", fb), msg,
      h("div", { class: "filters" }, h("button", { class: "btn", type: "submit" }, "সেভ"), h("button", { class: "btn alt", type: "button", onclick: () => dlg.close() }, "বাতিল")));
    f.onsubmit = async (e) => {
      e.preventDefault(); const b = body.value.trim(); if (!b) return (msg.textContent = "কনটেন্ট খালি রাখা যাবে না।");
      const tg = [...new Set(tags.value.split(/[,،]/).map((x) => x.trim()).filter(Boolean).map((x) => x.slice(0, 30)))].slice(0, 10);
      const row = { title: (title.value.trim() || b.split("\n")[0]).slice(0, 120), body: b, type: type.value, category: cat.value, status: st.value, language: lang.value, tags: tg, featured: feat.checked, admin_feedback: fb.value.trim() || null };
      msg.textContent = "সেভ হচ্ছে…";
      const r = c.id ? await sb.from("contents").update(row).eq("id", c.id) : await sb.from("contents").insert({ ...row, author_id: me.id });
      if (r.error) return (msg.textContent = "ব্যর্থ: " + errMsg(r.error));
      dlg.close(); toast("সেভ হয়েছে ✓"); reload();
    };
    rc(dlg, f); dlg.showModal();
  }

  // ---------- submissions ----------
  async function vSubs(box) {
    const r = must(await sb.from("contents").select("id,title,body,type,category,author_id,created_at").eq("status", "pending").order("created_at").limit(50)), rows = r.data || [];
    const ids = [...new Set(rows.map((x) => x.author_id).filter(Boolean))];
    const names = {}; if (ids.length) (must(await sb.from("profiles").select("id,display_name,username").in("id", ids)).data || []).forEach((p) => (names[p.id] = p.display_name || p.username || "ইউজার"));
    rc(box, h("h2", null, "সাবমিশন রিভিউ"), rows.length ? null : h("div", { class: "empty" }, "রিভিউয়ের জন্য কোনো পেন্ডিং সাবমিশন নেই।"),
      rows.map((c) => {
        const fb = h("input", { type: "text", maxlength: "300", placeholder: "ফিডব্যাক (ঐচ্ছিক)" });
        const act = (status) => async () => {
          if (status === "rejected" && !fb.value.trim() && !confirm("ফিডব্যাক ছাড়া বাতিল করবেন?")) return;
          const u = await sb.from("contents").update({ status, admin_feedback: fb.value.trim() || null }).eq("id", c.id);
          u.error ? toast("ব্যর্থ: " + errMsg(u.error)) : (toast(status === "published" ? "অনুমোদিত ✓" : "বাতিল করা হয়েছে"), go("submissions"));
        };
        return h("div", { class: "sub" }, h("div", { class: "meta" }, `${names[c.author_id] || "অজানা"} · ${TYPES[c.type] || c.type} · ${CATS[c.category] || c.category} · ${fmt(c.created_at)}`),
          h("p", null, c.body), fb, h("div", { class: "filters" }, h("button", { class: "btn", onclick: act("published") }, "অনুমোদন"), h("button", { class: "btn alt", onclick: act("rejected") }, "বাতিল"), h("button", { class: "ib", onclick: () => edit(c) }, "এডিট")));
      }));
  }

  // ---------- users ----------
  async function vUsers(box) {
    const search = h("input", { type: "search", placeholder: "নাম বা ইউজারনেম…" }), list = h("div");
    search.onchange = load; rc(box, h("h2", null, "ইউজার ম্যানেজমেন্ট"), h("p", { class: "meta" }, "গোপনীয়তার জন্য ইমেইল দেখানো হয় না।"), search, list); load();
    async function load() {
      let q = sb.from("profiles").select("id,username,display_name,role,is_suspended,created_at").order("created_at", { ascending: false }).limit(50);
      const s = safeQ(search.value); if (s) q = q.or(`username.ilike.%${s}%,display_name.ilike.%${s}%`);
      const rows = must(await q).data || [];
      if (!rows.length) return rc(list, h("div", { class: "empty" }, "কোনো ইউজার পাওয়া যায়নি।"));
      rc(list, h("div", { class: "tw" }, h("table", null, h("thead", null, h("tr", null, ["নাম", "যোগদান", "রোল", "স্ট্যাটাস", ""].map((x) => h("th", null, x)))),
        h("tbody", null, rows.map((u) => {
          const self = u.id === me.id, sel = h("select", { disabled: self, "aria-label": "রোল" }, opts(ROLES)); sel.value = u.role;
          sel.onchange = async () => { if (!confirm(`${u.display_name || u.username || "ইউজার"}-এর রোল "${ROLES[sel.value]}" করবেন?`)) { sel.value = u.role; return; } const r = await sb.from("profiles").update({ role: sel.value }).eq("id", u.id); r.error ? (toast("ব্যর্থ: " + errMsg(r.error)), (sel.value = u.role)) : (toast("রোল বদলেছে ✓"), (u.role = sel.value)); };
          return h("tr", null, h("td", null, u.display_name || "—", h("div", { class: "meta" }, u.username ? "@" + u.username : "")), h("td", null, fmt(u.created_at)), h("td", null, sel),
            h("td", null, u.is_suspended ? h("span", { class: "badge rejected" }, "সাসপেন্ড") : h("span", { class: "badge published" }, "সক্রিয়")),
            h("td", null, self ? null : h("button", { class: "ib mini", onclick: async () => { if (!confirm(u.is_suspended ? "অ্যাকাউন্ট পুনরুদ্ধার করবেন?" : "অ্যাকাউন্ট সাসপেন্ড করবেন?")) return; const r = await sb.from("profiles").update({ is_suspended: !u.is_suspended }).eq("id", u.id); r.error ? toast("ব্যর্থ: " + errMsg(r.error)) : load(); } }, u.is_suspended ? "পুনরুদ্ধার" : "সাসপেন্ড")));
        })))));
    }
  }

  // ---------- social links ----------
  const validUrl = (u) => { try { return new URL(u).protocol === "https:"; } catch { return false; } };
  async function vSocial(box) {
    const r = must(await sb.from("site_settings").select("value").eq("key", "social").maybeSingle());
    let items = Array.isArray(r.data && r.data.value) ? r.data.value.slice() : []; const wrap = h("div");
    const draw = () => rc(wrap, ...items.map((s, i) => {
      const plat = h("select", { "aria-label": "প্ল্যাটফর্ম" }, PLATFORMS.map((p) => h("option", { value: p }, p))); plat.value = s.platform || "custom";
      const name = h("input", { type: "text", value: s.name || "", placeholder: "দেখানোর নাম", maxlength: "30" }), url = h("input", { type: "url", value: s.url || "", placeholder: "https://…" });
      const en = h("input", { type: "checkbox", checked: s.enabled !== false }), ord = h("input", { type: "number", value: s.order != null ? s.order : i, "aria-label": "ক্রম" });
      plat.onchange = () => { s.platform = plat.value; if (!name.value && plat.value !== "custom") { name.value = plat.value[0].toUpperCase() + plat.value.slice(1); s.name = name.value; } };
      name.oninput = () => (s.name = name.value.trim()); url.oninput = () => (s.url = url.value.trim()); en.onchange = () => (s.enabled = en.checked); ord.oninput = () => (s.order = +ord.value);
      return h("div", { class: "sub form" }, h("div", { class: "two" }, h("label", null, "প্ল্যাটফর্ম", plat), h("label", null, "নাম", name)), h("label", null, "URL (শুধু https)", url),
        h("div", { class: "two" }, h("label", { class: "chk" }, en, "চালু"), h("label", null, "ক্রম", ord)), h("button", { class: "ib mini", onclick: () => { items.splice(i, 1); draw(); } }, "মুছুন"));
    }));
    draw();
    rc(box, h("h2", null, "সোশ্যাল লিংক ম্যানেজার"), h("p", { class: "meta" }, "শুধু আপনার আসল অফিসিয়াল https লিংক দিন। অনুমানে লিংক বানাবেন না।"), wrap,
      h("div", { class: "filters" }, h("button", { class: "ib", onclick: () => { items.push({ platform: "facebook", name: "Facebook", url: "", enabled: true, order: items.length }); draw(); } }, "+ প্ল্যাটফর্ম যোগ"),
        h("button", { class: "btn", onclick: async () => {
          const bad = items.find((s) => !s.name || !validUrl(s.url)); if (bad) return toast("প্রতিটি লিংকে নাম ও বৈধ https URL লাগবে");
          const clean = items.map((s, i) => ({ platform: s.platform || "custom", name: s.name, url: new URL(s.url).href, enabled: s.enabled !== false, order: s.order != null ? s.order : i }));
          const u = await sb.from("site_settings").upsert({ key: "social", value: clean, updated_by: me.id, updated_at: new Date().toISOString() });
          u.error ? toast("ব্যর্থ: " + errMsg(u.error)) : toast("সেভ হয়েছে ✓ (সাইটে দেখা যাবে)");
        } }, "সেভ")));
  }

  // ---------- settings ----------
  async function vSettings(box) {
    const w = (must(await sb.from("site_settings").select("value").eq("key", "watermark").maybeSingle()).data || {}).value || { enabled: true, position: "br", opacity: 0.5 };
    const on = h("input", { type: "checkbox", checked: w.enabled !== false }), pos = h("select", null, h("option", { value: "br" }, "নিচে ডানে"), h("option", { value: "bl" }, "নিচে বামে"), h("option", { value: "bc" }, "নিচে মাঝে"), h("option", { value: "tr" }, "উপরে ডানে"), h("option", { value: "tl" }, "উপরে বামে"));
    pos.value = w.position || "br"; const op = h("input", { type: "number", min: "0.1", max: "1", step: "0.05", value: w.opacity != null ? w.opacity : 0.5 });
    const mfaBox = h("div"); drawMfa();
    rc(box, h("h2", null, "সেটিংস"),
      h("div", { class: "sub form" }, h("h3", null, "ডিজাইন স্টুডিও ওয়াটারমার্ক (ডিফল্ট)"), h("label", { class: "chk" }, on, "চালু"), h("label", null, "জায়গা", pos), h("label", null, "স্বচ্ছতা (০.১–১)", op),
        h("button", { class: "btn", onclick: async () => { const v = { enabled: on.checked, position: pos.value, opacity: Math.min(1, Math.max(0.1, +op.value || 0.5)) }; const u = await sb.from("site_settings").upsert({ key: "watermark", value: v, updated_by: me.id, updated_at: new Date().toISOString() }); u.error ? toast("ব্যর্থ: " + errMsg(u.error)) : toast("সেভ হয়েছে ✓"); } }, "সেভ")),
      h("div", { class: "sub form" }, h("h3", null, "মাল্টি-ফ্যাক্টর অথেন্টিকেশন (MFA)"), mfaBox),
      h("div", { class: "sub" }, h("h3", null, "ব্যাকআপ / এক্সপোর্ট"), h("p", { class: "meta" }, "সব কনটেন্ট ডাউনলোড করে নিরাপদ জায়গায় রাখুন। (Supabase ফ্রি প্ল্যানে অটো ব্যাকআপ সীমিত।)"),
        h("div", { class: "filters" }, h("button", { class: "ib", onclick: () => exportAll("json") }, "⬇ JSON"), h("button", { class: "ib", onclick: () => exportAll("csv") }, "⬇ CSV"))));
    async function drawMfa() {
      const { data } = await sb.auth.mfa.listFactors(), ver = ((data && data.totp) || []).filter((x) => x.status === "verified");
      if (ver.length) return rc(mfaBox, h("p", null, "✅ MFA চালু আছে।"), h("button", { class: "ib", onclick: async () => { if (!confirm("MFA বন্ধ করলে অ্যাকাউন্ট কম নিরাপদ হবে। নিশ্চিত?")) return; const r = await sb.auth.mfa.unenroll({ factorId: ver[0].id }); r.error ? toast("ব্যর্থ: " + errMsg(r.error)) : drawMfa(); } }, "MFA বন্ধ করুন"));
      rc(mfaBox, h("p", null, "⚠ MFA চালু নেই।"), h("button", { class: "btn", onclick: enroll }, "MFA চালু করুন"));
    }
    async function enroll() {
      const e = await sb.auth.mfa.enroll({ factorType: "totp" }); if (e.error) return toast("ব্যর্থ: " + errMsg(e.error));
      const code = h("input", { type: "text", inputmode: "numeric", maxlength: "6", placeholder: "৬ সংখ্যার কোড" }), msg = h("p", { class: "meta", role: "status" });
      rc(mfaBox, h("p", null, "Google Authenticator বা অন্য অথেন্টিকেটর অ্যাপে QR স্ক্যান করুন:"), h("div", { class: "qr" }, h("img", { src: e.data.totp.qr_code, alt: "MFA QR কোড" })),
        h("p", { class: "meta" }, "স্ক্যান না হলে এই কী দিন: ", h("code", null, e.data.totp.secret)), code, msg,
        h("button", { class: "btn", onclick: async () => { const c = await sb.auth.mfa.challenge({ factorId: e.data.id }); if (c.error) return (msg.textContent = "ব্যর্থ"); const v = await sb.auth.mfa.verify({ factorId: e.data.id, challengeId: c.data.id, code: code.value.trim() }); v.error ? (msg.textContent = "কোড ভুল") : (toast("MFA চালু হয়েছে ✓"), drawMfa()); } }, "যাচাই ও চালু করুন"));
    }
  }
  async function exportAll(kind) {
    const rows = []; for (let from = 0; from < 20000; from += 1000) { const r = await sb.from("contents").select("*").order("created_at").range(from, from + 999); if (r.error) return toast("এক্সপোর্ট ব্যর্থ: " + errMsg(r.error)); rows.push(...r.data); if (r.data.length < 1000) break; }
    let text, mime; if (kind === "json") { text = JSON.stringify(rows, null, 2); mime = "application/json"; } else {
      const cols = ["id", "title", "body", "type", "category", "tags", "language", "status", "featured", "views", "copies", "shares", "likes", "created_at"];
      const esc = (v) => { v = Array.isArray(v) ? v.join("|") : v == null ? "" : String(v); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
      text = "\ufeff" + [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\r\n"); mime = "text/csv";
    }
    const a = h("a", { href: URL.createObjectURL(new Blob([text], { type: mime + ";charset=utf-8" })), download: `contents-${new Date().toISOString().slice(0, 10)}.${kind}` }); document.body.appendChild(a); a.click(); a.remove();
    toast(`${rows.length}টি কনটেন্ট এক্সপোর্ট হয়েছে`);
  }

  // ---------- audit ----------
  async function vAudit(box) {
    const rows = must(await sb.from("audit_logs").select("id,at,actor,action,table_name,row_id,details").order("at", { ascending: false }).limit(100)).data || [];
    const ids = [...new Set(rows.map((x) => x.actor).filter(Boolean))], names = {};
    if (ids.length) (must(await sb.from("profiles").select("id,display_name,username").in("id", ids)).data || []).forEach((p) => (names[p.id] = p.display_name || p.username || p.id.slice(0, 6)));
    rc(box, h("h2", null, "অডিট লগ"), h("p", { class: "meta" }, "এই লগ ক্লায়েন্ট থেকে পরিবর্তন বা মোছা যায় না। শেষ ১০০টি দেখানো হচ্ছে।"),
      rows.length ? h("div", { class: "tw" }, h("table", null, h("thead", null, h("tr", null, ["সময়", "কে", "কী", "কোথায়", "বিবরণ"].map((x) => h("th", null, x)))),
        h("tbody", null, rows.map((l) => { const d = l.details || {}; const info = [d.title, d.changed && d.changed.length ? "বদল: " + d.changed.join(", ") : "", d.old_status !== d.new_status && d.new_status ? `${d.old_status || "-"} → ${d.new_status}` : "", d.new_role && d.old_role !== d.new_role ? `${d.old_role} → ${d.new_role}` : ""].filter(Boolean).join(" · ");
          return h("tr", null, h("td", null, fmt(l.at)), h("td", null, names[l.actor] || (l.actor ? "অজানা" : "সিস্টেম/SQL")), h("td", null, l.action), h("td", null, l.table_name), h("td", null, h("div", { class: "t" }, info))); })))) : h("div", { class: "empty" }, "এখনো কোনো লগ নেই।"));
  }

  boot();
})();
