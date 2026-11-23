/* Page behaviour: what the 3D scene shows at each scroll position, labels pinned
   to the building, the tilted website pages, tabs, the chat and the form. */
(function () {
  "use strict";
  var doc = document.documentElement;
  doc.classList.add("js");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function smooth(a, b, t) { t = clamp((t - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

  /* ---------- reveal on scroll ---------- */

  var reveals = $$(".reveal");
  function countUp(el) {
    var target = Number(el.getAttribute("data-count")), start = performance.now();
    if (reduce || !target) return;
    (function frame(now) {
      var t = clamp((now - start) / 1300, 0, 1), e = 1 - Math.pow(1 - t, 3);
      el.textContent = String(Math.round(target * e));
      if (t < 1) requestAnimationFrame(frame);
    })(start);
  }
  function show(el) {
    if (el.classList.contains("is-in")) return;
    el.classList.add("is-in");
    $$("[data-count]", el).forEach(countUp);
  }
  function showAll() {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
    $$(".msg.is-pending").forEach(function (m) { m.classList.remove("is-pending"); });
  }
  // Never leave content hidden: background tabs throttle observers, and print needs everything.
  window.addEventListener("beforeprint", showAll);
  var canObserve = "IntersectionObserver" in window && !reduce && document.visibilityState !== "hidden";
  if (canObserve) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    showAll();
  }

  /* ---------- what the scene shows at each stop ---------- */

  var BASE = {
    az: 0.75, el: 0.3, dist: 78, tx: 2, ty: 9, tz: -1, ox: 0.2, oy: 0, sway: 0.08,
    world: 1, grid: 1, context: 0, found: 1, floor: 0, struct: 1, slabs: 1, blocks: 0, crane: 0, scaffold: 0,
    services: 0, facade: 1, roof: 1, beacon: 0, dims: 0, land: 0, explode: 0, logo: 0, proton: 0, tagSite: 0, tagExp: 0,
    // real: how solid the built parts are. ghost: how visible the unbuilt design model is. lights: windows lit.
    real: 1, ghost: 0, lights: 0, pside: 1
  };
  var KEYS = Object.keys(BASE);
  function S(o) { var s = {}, k; for (k in BASE) s[k] = BASE[k]; for (k in o) s[k] = o[k]; return s; }
  var ROLES_VIEW = { az: 0.9, el: 0.42, dist: 96, tx: 1, ty: 8.5, tz: -1, floor: 1, blocks: 1, crane: 1, scaffold: 1, beacon: 1, lights: 0.5 };
  function R(o) { var s = S(ROLES_VIEW), k; for (k in o) s[k] = o[k]; return s; }

  // The walkthrough starts from the design model (lines only). From the foundation on, what is built
  // turns solid while the rest of the model waits as a ghost, and it ends as a finished, lit building.
  var STATES = {
    logo: S({ world: 0, grid: 0, found: 0, struct: 0, slabs: 0, facade: 0, roof: 0, real: 0, logo: 1, ox: 0, az: 1.05, el: 0.4, dist: 116, moy: 0 }),
    site: S({ real: 0, context: 1, dims: 1, tagSite: 1, moy: 0.2 }),
    ch1: S({ az: 0.6, el: 0.15, dist: 44, tx: 0, ty: -1.2, tz: 0, struct: 0, slabs: 0, facade: 0, roof: 0, ghost: 0.16 }),
    ch2: S({ az: 0.95, el: 0.22, dist: 72, tx: 0, ty: 8.5, tz: 0, floor: 1, slabs: 0, facade: 0, roof: 0, dims: 1, ghost: 0.15 }),
    ch3: S({ az: 0.5, el: 0.66, dist: 70, tx: 0, ty: 8, tz: 0, floor: 0.25, blocks: 1, facade: 0, roof: 0, ghost: 0.13 }),
    ch4: S({ az: 1.45, el: 0.26, dist: 86, tx: 3, ty: 11, tz: -3, facade: 0, roof: 0, crane: 1, scaffold: 1, ghost: 0.12 }),
    ch5: S({ az: 0.3, el: 0.2, dist: 60, tx: 0, ty: 9, tz: 0, facade: 0, roof: 0, crane: 1, services: 1, ghost: 0.12 }),
    ch6: S({ az: 0.62, el: 0.14, dist: 78, tx: 0, ty: 9.5, tz: 0, lights: 1, land: 1, grid: 0.45 }),
    exploded: S({ az: 0.785, el: 0.5, dist: 132, tx: 0, ty: 16, tz: 0, ox: 0, oy: 0.09, fitH: 900, explode: 1, floor: 0.6, blocks: 1, services: 1, beacon: 1, tagExp: 1, grid: 0.3, lights: 0.5, moy: 0.03 }),
    web: R({ world: 0, ox: 0, moy: 0 }),
    protonR: R({ world: 0, ox: 0, proton: 1, pside: 1, moy: 0 }),
    protonL: R({ world: 0, ox: 0, proton: 1, pside: -1, moy: 0 }),
    roles: R({ ox: 0.24, moy: -0.25 }),
    rolesOff: R({ ox: 0.24, world: 0, moy: -0.25 }),
    contact: S({ az: -0.55, el: 0.2, dist: 118, tx: 0, ty: 10, tz: 0, ox: 0, oy: -0.1, context: 1, beacon: 1, lights: 1, land: 1, sway: 0.14, moy: -0.12 }),
    contactOff: S({ az: -0.55, el: 0.2, dist: 118, tx: 0, ty: 10, tz: 0, ox: 0, oy: -0.3, context: 1, beacon: 1, lights: 1, land: 1, world: 0, moy: -0.3 })
  };
  var STOPS = [
    ["#hero", "logo"], ["#site", "site"], ["#ch-foundation", "ch1"], ["#ch-structure", "ch2"], ["#ch-floors", "ch3"],
    ["#ch-site", "ch4"], ["#ch-services", "ch5"], ["#ch-envelope", "ch6"], ["#modules", "exploded"], ["#website", "web"],
    ["#prow-1", "protonR"], ["#prow-2", "protonL"], ["#prow-3", "protonR"], ["#prow-4", "protonL"], ["#prow-5", "protonR"],
    ["#prow-6", "protonL"], ["#roles", "roles"], ["#security", "rolesOff"],
    ["#contact", "contact"], ["#contact-body", "contactOff"]
  ];
  var stops = STOPS.map(function (d) { return { el: $(d[0]), name: d[1], c: 0, s: null }; }).filter(function (s) { return s.el; });
  var vh = window.innerHeight, narrow = false, active = 0, out = {};
  var heroEl = $("#hero"), heroInner = $(".hero__inner"), heroBox = { top: 68, bottom: 400 };

  function adjust(s) {
    // a page that loads in a hidden tab can report a window of zero size
    var o = {}, k, asp = (window.innerWidth || 1280) / (window.innerHeight || 800);
    for (k = 0; k < KEYS.length; k++) o[KEYS[k]] = s[KEYS[k]];
    o.dist = s.dist * Math.min(2.3, Math.max(1, 1.25 / asp));
    if (s.fitH) o.dist *= clamp(s.fitH / (window.innerHeight || 800), 1, 1.5);
    if (narrow) { o.ox = 0; o.oy = s.moy !== undefined ? s.moy : -0.2; }
    return o;
  }
  function measure() {
    vh = window.innerHeight || 800;
    narrow = (window.innerWidth || 1280) < 900;
    var y = window.scrollY;
    stops.forEach(function (s) {
      var r = s.el.getBoundingClientRect();
      s.c = r.top + y + r.height * 0.5;
      s.s = adjust(STATES[s.name]);
      // Proton rows: remember where the card is, so the orb can look at it
      var card = s.el.querySelector(".prow__card");
      if (card) {
        var cr = card.getBoundingClientRect();
        s.gx = ((cr.left + cr.width / 2) / window.innerWidth) * 2 - 1;
        s.gy = cr.top + y + cr.height / 2;
      }
    });
    if (heroEl && heroInner) {
      heroBox.top = heroEl.getBoundingClientRect().top + y;
      heroBox.bottom = heroInner.getBoundingClientRect().top + y;
    }
    measureShots();
  }
  function getState() {
    var y = window.scrollY + vh * 0.5, i = 0, k;
    while (i < stops.length - 2 && y >= stops[i + 1].c) i++;
    var a = stops[i], b = stops[i + 1];
    var raw = (y - a.c) / Math.max(1, b.c - a.c), t = smooth(0.12, 0.88, raw);
    for (k = 0; k < KEYS.length; k++) out[KEYS[k]] = a.s[KEYS[k]] + (b.s[KEYS[k]] - a.s[KEYS[k]]) * t;
    // the orb stays beside a card for longer, then crosses quickly
    out.pside = a.s.pside + (b.s.pside - a.s.pside) * smooth(0.3, 0.7, raw);
    active = t < 0.5 ? i : i + 1;
    if (scene) {
      var st = stops[active];
      if (st.gy !== undefined) scene.setGaze(st.gx, -(((st.gy - window.scrollY) / vh) * 2 - 1)); else scene.setGaze();
    }
    // The logo sits in the free space above the hero text and scrolls away with it.
    if (scene) scene.setLogoBox(((heroBox.top + heroBox.bottom) / 2 - window.scrollY) / vh, (heroBox.bottom - heroBox.top) / vh);
    return out;
  }

  /* ---------- labels, ruler and role focus, once per rendered frame ---------- */

  var tags = $$(".tag").map(function (el) { return { el: el, anchor: el.getAttribute("data-anchor"), group: el.getAttribute("data-group"), on: false }; });
  var rulerLinks = $$(".ruler a"), lastName = "", pt = { x: 0, y: 0, ok: true };
  var ROLE_FOCUS = {
    owner: { dims: { rest: 1, floor: 0.5 } },
    finance: { dims: { rest: 0.06, found: 1, floor: 1, struct: 0.28 } },
    lead: { dims: { rest: 0.06, slabs: 1, blocks: 1, struct: 0.28, floor: 0 } },
    site: { dims: { rest: 0.05, crane: 1, scaffold: 1, struct: 0.26, found: 0.18, floor: 0 } },
    designer: { dims: { rest: 0.05, slabs: 1, blocks: 1, struct: 0.18, floor: 0 }, level: 2 },
    client: { dims: { rest: 0.04, facade: 1, roof: 0.7, floor: 0 } }
  };
  var role = "owner", scene = null;

  function applyFocus() {
    if (!scene) return;
    var f = stops[active] && stops[active].name === "roles" ? ROLE_FOCUS[role] : null;
    scene.setFocus(f ? f.dims : null, f ? f.level : null);
  }
  function onFrame(cur, api) {
    var name = stops[active].name, i;
    if (name !== lastName) {
      lastName = name;
      applyFocus();
      var idx = active - 2;
      document.body.classList.toggle("in-story", idx >= 0 && idx <= 6);
      for (i = 0; i < rulerLinks.length; i++) rulerLinks[i].classList.toggle("is-active", i === idx);
    }
    for (i = 0; i < tags.length; i++) {
      var tg = tags[i];
      var g = tg.group === "site" ? cur.tagSite * cur.world : smooth(0.55, 0.95, cur.tagExp) * cur.world;
      if (g < 0.02) {
        if (tg.on) { tg.el.style.opacity = "0"; tg.on = false; }
        continue;
      }
      api.project(tg.anchor, pt);
      tg.el.style.opacity = pt.ok ? g.toFixed(2) : "0";
      tg.el.style.transform = "translate3d(" + pt.x.toFixed(1) + "px," + pt.y.toFixed(1) + "px,0)";
      tg.on = true;
    }
  }

  /* ---------- websites: tilted pages that scroll inside their frames ---------- */

  var stage = $("#web-stage"), plane = $(".web__plane");
  var shots = $$(".shot__page").map(function (el) {
    return {
      el: el, view: el.parentNode, from: Number(el.getAttribute("data-from")), to: Number(el.getAttribute("data-to")),
      ratio: Number(el.getAttribute("data-h")) / Number(el.getAttribute("data-w")), h: 0, max: 0
    };
  });
  var globeCanvas = $("#web-globe");
  var globe = globeCanvas && window.HourlineGlobe ? window.HourlineGlobe.create(globeCanvas) : null;
  var tilt = { x: 0, y: 0, tx: 0, ty: 0 }, frame = 0;
  function measureShots() {
    shots.forEach(function (s) {
      s.h = s.view.clientWidth * s.ratio;
      s.max = Math.max(0, s.h - s.view.clientHeight);
    });
    if (globe) globe.resize();
  }
  if (stage) {
    stage.addEventListener("pointermove", function (e) {
      var r = stage.getBoundingClientRect();
      tilt.tx = (e.clientX - r.left) / r.width - 0.5;
      tilt.ty = (e.clientY - r.top) / r.height - 0.5;
    });
    stage.addEventListener("pointerleave", function () { tilt.tx = 0; tilt.ty = 0; });
  }
  function tick(now) {
    requestAnimationFrame(tick);
    if (!stage) return;
    var r = stage.getBoundingClientRect();
    if (r.bottom < -200 || r.top > vh + 200) return;
    var p = reduce ? 0.5 : clamp((vh - r.top) / (vh + r.height), 0, 1);
    tilt.x += (tilt.tx - tilt.x) * 0.08;
    tilt.y += (tilt.ty - tilt.y) * 0.08;
    plane.style.setProperty("--py", ((0.5 - p) * 150).toFixed(1));
    plane.style.setProperty("--px", ((0.5 - p) * 70).toFixed(1));
    plane.style.setProperty("--ry", (tilt.x * 9).toFixed(2) + "deg");
    plane.style.setProperty("--rx", (-tilt.y * 7).toFixed(2) + "deg");
    for (var i = 0; i < shots.length; i++) {
      var s = shots[i], off = Math.min(s.max, (s.from + (s.to - s.from) * p) * s.h);
      s.el.style.transform = "translate3d(0," + (-off).toFixed(1) + "px,0)";
    }
    // the globe on the home page: spins, at half the frame rate to stay light
    if (globe && (frame++ % 2 === 0)) globe.draw(reduce ? 4 : (now || 0) / 1000);
  }

  /* ---------- Proton conversation plays in order once it is on screen ---------- */

  var chat = $("#chat");
  if (chat && canObserve) {
    var msgs = $$(".msg", chat), played = false;
    msgs.forEach(function (m) { m.classList.add("is-pending"); });
    var chatIo = new IntersectionObserver(function (entries) {
      if (played || !entries[0].isIntersecting) return;
      played = true;
      msgs.forEach(function (m, i) { setTimeout(function () { m.classList.remove("is-pending"); }, 300 + i * 900); });
      chatIo.disconnect();
    }, { threshold: 0.3 });
    chatIo.observe(chat);
  }

  /* ---------- role tabs: the building lights up what each role can open ---------- */

  var tabs = $$('[role="tab"]');
  function selectTab(tab) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      var panel = document.getElementById(t.getAttribute("aria-controls"));
      if (panel) panel.hidden = !on;
    });
    role = tab.getAttribute("data-role") || "owner";
    applyFocus();
  }
  tabs.forEach(function (tab, i) {
    tab.addEventListener("click", function () { selectTab(tab); });
    tab.addEventListener("keydown", function (e) {
      var next = null;
      if (e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
      if (e.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
      if (next) { e.preventDefault(); selectTab(next); next.focus(); }
    });
  });

  /* ---------- mobile menu ---------- */

  var toggle = $(".nav__toggle"), menu = $("#mobile-menu");
  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      menu.hidden = open;
    });
    menu.addEventListener("click", function (e) {
      if (e.target.tagName === "A") { menu.hidden = true; toggle.setAttribute("aria-expanded", "false"); }
    });
  }

  /* ---------- contact form: validate, then open the visitor's email app (no backend) ---------- */

  var form = $("#contact-form");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var ok = true;
      ["f-name", "f-company"].forEach(function (id) {
        var input = document.getElementById(id), field = input.closest(".field"), err = $(".field__error", field);
        var bad = !input.value.trim();
        field.classList.toggle("has-error", bad);
        err.hidden = !bad;
        if (bad && ok) { input.focus(); ok = false; }
      });
      if (!ok) return;
      var data = new FormData(form);
      var body = "Name: " + data.get("name") + "\nCompany: " + data.get("company") +
        "\nFirm: " + data.get("type") + "\n\n" + (data.get("message") || "");
      // Placeholder address: replace before publishing.
      window.location.href = "mailto:sales@example.com?subject=" +
        encodeURIComponent("Demo request: " + data.get("company")) + "&body=" + encodeURIComponent(body);
    });
  }

  var year = $("#year");
  if (year) year.textContent = String(new Date().getFullYear());

  /* ---------- start ---------- */

  measure();
  window.addEventListener("resize", measure);
  window.addEventListener("load", measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  if ("ResizeObserver" in window) new ResizeObserver(measure).observe(document.body);

  var canvas = $("#scene");
  if (canvas && window.THREE && window.HourlineScene) {
    scene = window.HourlineScene.create(canvas, { getState: getState, onFrame: onFrame, reduceMotion: reduce, line: "#e9edf3", accent: "#ff6a3c" });
  }
  if (scene) { scene.start(); window.__hourline = scene; } else { doc.classList.add("no-webgl"); }
  requestAnimationFrame(tick);
})();
