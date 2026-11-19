document.addEventListener("DOMContentLoaded", () => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Loader + header */
  const loader = $("#pageLoader"), navbar = $("#navbar");
  addEventListener("load", () => setTimeout(() => loader.classList.add("hidden"), 600));
  if (document.readyState === "complete") setTimeout(() => loader.classList.add("hidden"), 600);
  const onScroll = () => {
    navbar.classList.toggle("scrolled", scrollY > 24);
    const t = $("#flowTrack"), r = t.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (innerHeight * .75 - r.top) / (r.height + 120)));
    $("#flowFill").style.width = p * 100 + "%";
    $$(".flow-step").forEach((s, i) => s.classList.toggle("on", p > i / 3 + .02));
  };
  addEventListener("scroll", onScroll, { passive: true }); onScroll();

  /* Mobile menu */
  const toggle = $("#menuToggle"), nav = $("#navLinks");
  toggle.addEventListener("click", () => {
    const o = toggle.classList.toggle("open");
    nav.classList.toggle("open", o);
    toggle.setAttribute("aria-expanded", o);
  });
  $$(".nav-link").forEach(l => l.addEventListener("click", () => { nav.classList.remove("open"); toggle.classList.remove("open"); }));

  /* Reveal, active link, counters */
  $$(".section h2,.console-box,.card,.flow-step,.trust li,.closing h2").forEach(e => e.classList.add("reveal"));
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add("visible"); io.unobserve(e.target); }
  }), { threshold: .15 });
  $$(".reveal").forEach(e => io.observe(e));

  const links = $$(".nav-link");
  $$("main section[id]").forEach(sec => new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) links.forEach(l => l.classList.toggle("active", l.getAttribute("href") === "#" + sec.id));
  }), { rootMargin: "-40% 0px -50% 0px" }).observe(sec));

  $$("[data-count]").forEach(el => {
    const end = +el.dataset.count, suf = el.dataset.suffix || "", pre = (el.dataset.prefix || "").replace("&lt;", "<");
    new IntersectionObserver((es, o) => es.forEach(e => {
      if (!e.isIntersecting) return; o.disconnect();
      const t0 = performance.now();
      (function tick(t) {
        const k = Math.min(1, (t - t0) / 1400);
        el.textContent = pre + Math.round(end * (1 - Math.pow(1 - k, 3))) + suf;
        if (k < 1) requestAnimationFrame(tick);
      })(t0);
    })).observe(el);
  });

  /* Workspace tabs */
  const days = ["MON 16", "TUE 17", "WED 18", "THU 19", "FRI 20"];
  const views = {
    requests: () => `<div><h3>Every request has a visible status.</h3><p>Submit once, then watch it move from received to reviewed to answered.</p></div>
      <div class="demo"><div class="row"><span class="ico">✓</span><div><strong>Request submitted</strong><small>Received by your provider</small></div><span class="tag">Done</span></div>
      <div class="row"><span class="ico cur">●</span><div><strong>Specialist referral</strong><small>Under clinical review</small></div><span class="tag wait">In review</span></div>
      <div class="row"><span class="ico off">○</span><div><strong>Decision and next steps</strong><small>Appears here when ready</small></div></div></div>`,
    appointments: () => `<div><h3>Your schedule, always current.</h3><p>Pick a day to preview your visit. Changes from your clinic show up instantly.</p></div>
      <div class="demo"><div class="days">${days.map((d, i) => `<button class="day${i === 3 ? " sel" : ""}" data-i="${i}"><small>${d.split(" ")[0]}</small><b>${d.split(" ")[1]}</b></button>`).join("")}</div>
      <div class="row" id="slot"><span class="ico">＋</span><div><strong>Consultation</strong><small>Thu 19 · 10:30 AM</small></div><span class="tag">Confirmed</span></div></div>`,
    documents: () => `<div><h3>Your records, ready when you are.</h3><p>Reports, referrals and lab results stay organized and open in one tap.</p></div>
      <div class="demo"><div class="row scan"><span class="ico">PDF</span><div><strong>Medical report</strong><small>Updated 12 Nov</small></div><span class="tag">Open</span></div>
      <div class="row"><span class="ico">PDF</span><div><strong>Referral letter</strong><small>Added 08 Nov</small></div><span class="tag">Open</span></div>
      <div class="row"><span class="ico">PDF</span><div><strong>Lab results</strong><small>Added 02 Nov</small></div><span class="tag">Open</span></div></div>`
  };
  const panel = $("#panel");
  const show = k => {
    panel.classList.remove("enter"); panel.innerHTML = views[k](); void panel.offsetWidth; panel.classList.add("enter");
    $$(".day", panel).forEach(b => b.addEventListener("click", () => {
      $$(".day", panel).forEach(x => x.classList.toggle("sel", x === b));
      const [d, n] = days[b.dataset.i].split(" ");
      const times = ["9:00 AM", "2:15 PM", "11:40 AM", "10:30 AM", "4:00 PM"];
      $("#slot small").textContent = `${d[0] + d.slice(1).toLowerCase()} ${n} · ${times[b.dataset.i]}`;
    }));
  };
  $$(".tab").forEach(t => t.addEventListener("click", () => {
    $$(".tab").forEach(x => x.classList.toggle("active", x === t)); show(t.dataset.tab);
  }));
  show("requests");

  /* Magnetic CTA */
  const mag = $("#magnet");
  if (!reduce && matchMedia("(pointer:fine)").matches) {
    mag.parentElement.addEventListener("pointermove", e => {
      const b = mag.getBoundingClientRect();
      mag.style.transform = `translate(${(e.clientX - b.left - b.width / 2) * .25}px,${(e.clientY - b.top - b.height / 2) * .25}px)`;
    });
    mag.parentElement.addEventListener("pointerleave", () => mag.style.transform = "");
  }

  /* Live vitals */
  const bpm = $("#bpm");
  setInterval(() => bpm.textContent = 68 + Math.round(Math.random() * 7), 1800);

  /* Hero: particle heart that beats, repels from the cursor */
  const cv = $("#heroCanvas"), ctx = cv.getContext("2d");
  let W, H, mx = -999, my = -999, running = true, pts = [];
  const mobile = () => W < 900;
  const build = () => {
    const dpr = Math.min(devicePixelRatio, 2);
    W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = mobile() ? 420 : 900, sc = Math.min(W, H) * (mobile() ? .018 : .026), cx = mobile() ? W / 2 : W * .72, cy = H * (mobile() ? .72 : .5);
    pts = Array.from({ length: n }, (_, i) => {
      const t = Math.random() * 6.283, k = Math.sqrt(Math.random()) * .92 + (i % 5 === 0 ? .08 : 0);
      const hx = 16 * Math.sin(t) ** 3, hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      return { bx: hx * k, by: hy * k, x: cx + (Math.random() - .5) * W, y: cy + (Math.random() - .5) * H, vx: 0, vy: 0, cx, cy, sc, r: Math.random() * 2 + 1, m: Math.random() };
    });
  };
  build(); addEventListener("resize", build);
  addEventListener("pointermove", e => {
    const b = cv.getBoundingClientRect(); mx = e.clientX - b.left; my = e.clientY - b.top;
    const dx = e.clientX / innerWidth - .5, dy = e.clientY / innerHeight - .5;
    $$(".chip").forEach((c, i) => { c.style.setProperty("--px", dx * (14 + i * 6) + "px"); c.style.setProperty("--py", dy * (14 + i * 6) + "px"); });
  });
  new IntersectionObserver(([e]) => running = e.isIntersecting).observe(cv);
  const hb = u => Math.exp(-((u - .12) ** 2) / .004) * .9 + Math.exp(-((u - .3) ** 2) / .01) * .5;
  const frame = ms => {
    requestAnimationFrame(frame);
    if (!running) return;
    const t = reduce ? 1 : ms / 1000, beat = hb((t % 1.1) / 1.1);
    ctx.clearRect(0, 0, W, H);
    for (const p of pts) {
      const s = p.sc * (1 + beat * .07), tx = p.cx + p.bx * s + Math.sin(t + p.m * 9) * 3, ty = p.cy + p.by * s + Math.cos(t + p.m * 9) * 3;
      const dx = p.x - mx, dy = p.y - my, d = Math.hypot(dx, dy);
      if (d < 110) { const f = (110 - d) / 110 * 3; p.vx += dx / d * f; p.vy += dy / d * f; }
      p.vx += (tx - p.x) * .035; p.vy += (ty - p.y) * .035; p.vx *= .86; p.vy *= .86; p.x += p.vx; p.y += p.vy;
      const k = Math.min(1, Math.max(0, (p.x - p.cx) / (p.sc * 32) + .5));
      ctx.fillStyle = `rgba(${Math.round(236 - 112 * k)},${Math.round(111 - 19 * k)},${Math.round(168 + 87 * k)},${.35 + p.m * .5})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + beat * .5), 0, 7); ctx.fill();
    }
  };
  requestAnimationFrame(frame);
});
