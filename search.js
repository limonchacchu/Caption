// Part 05: Bangla/English typo-tolerant search using Fuse.js.
// Load BEFORE this file:
//   the Fuse.js 7.0.0 script from jsdelivr (see index.html)
// Usage:
//   const engine = CaptionSearch.create(items); // items: [{id,title,body,category,tags:[...]}]
//   const results = engine.search('valobashar caption');
//   const onType = CaptionSearch.debounce(q => render(engine.search(q)), 250);
(function (global) {
  // Normalize Bangla variants so ভালবাসা ~ ভালোবাসা
  function normalize(s) {
    return (s || '').toString().normalize('NFC').toLowerCase()
      .replace(/\u09CB/g, '')
      .replace(/[^\p{L}\p{N}\p{M}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  }
  // Roman-Bangla bridge (extend freely)
  const ROMAN = { valobas:'ভালোবাসা', bhalobas:'ভালোবাসা', prem:'প্রেম', kosto:'কষ্ট',
    bondhu:'বন্ধুত্ব', sad:'কষ্ট', love:'ভালোবাসা', romantic:'রোমান্টিক', attitude:'অ্যাটিটিউড' };
  function expand(q) {
    const words = normalize(q).split(' ').filter(Boolean);
    const extra = [];
    words.forEach(w => { for (const k in ROMAN) if (w.startsWith(k)) extra.push(normalize(ROMAN[k])); });
    return [...new Set([...words, ...extra])].join(' ');
  }
  function create(items) {
    const data = items.map(i => ({ ...i, _t: normalize(i.title), _b: normalize(i.body),
      _g: (i.tags || []).map(normalize).join(' '), _c: normalize(i.category) }));
    // Fallback if the Fuse.js CDN is unreachable: simple substring matching so the site never breaks
    const fuse = global.Fuse ? new global.Fuse(data, {
      threshold: 0.35, ignoreLocation: true, minMatchCharLength: 2,
      keys: [{ name: '_t', weight: 3 }, { name: '_g', weight: 2 }, { name: '_c', weight: 2 }, { name: '_b', weight: 1 }]
    }) : {
      search(q, o) {
        const ws = q.split(' ').filter(Boolean);
        return data.map((i) => ({ item: i, sc: ws.filter((w) => (i._t + ' ' + i._g + ' ' + i._c + ' ' + i._b).includes(w)).length })).filter((x) => x.sc).sort((a, b) => b.sc - a.sc).slice(0, (o && o.limit) || 30);
      }
    };
    const cache = new Map();
    return {
      search(q, limit = 30) {
        const key = normalize(q); if (!key) return [];
        if (cache.has(key)) return cache.get(key);
        const out = fuse.search(expand(q), { limit }).map(r => r.item);
        cache.set(key, out); if (cache.size > 100) cache.delete(cache.keys().next().value);
        return out;
      }
    };
  }
  function debounce(fn, ms = 250) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
  global.CaptionSearch = { create, debounce, normalize };
})(window);
