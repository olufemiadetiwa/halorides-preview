// Vanilla replacement for the original Next.js client behaviour.
// Forms are mocked locally: nothing is sent to any backend.
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var path = location.pathname.replace(/\/index\.html$/, "").replace(/\/$/, "") || "/halorides-preview/en";

  // Header: scrolled state + current-page highlight
  var header = $(".header");
  var menuOpen = false;
  function syncHeader() { if (header) header.dataset.scrolled = String(window.scrollY > 8 || menuOpen); }
  window.addEventListener("scroll", syncHeader, { passive: true });
  syncHeader();
  $$(".header__nav a").forEach(function (a) {
    if (a.getAttribute("href") === path) a.setAttribute("aria-current", "page");
  });

  // Mobile menu
  var ICON_MENU = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h16M4 16h16"></path></svg>';
  var ICON_CLOSE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg>';
  var btn = $(".menu-btn");
  if (btn && header) {
    var menu = document.createElement("div");
    menu.className = "mobile-menu";
    menu.id = "mobile-menu";
    var links = $$(".header__nav a").map(function (a) { return [a.getAttribute("href"), a.textContent]; })
      .concat([["/halorides-preview/en/about", "About"], ["/halorides-preview/en/help", "Help"]]);
    menu.innerHTML = links.map(function (l) { return '<a class="mobile-link" href="' + l[0] + '">' + l[1] + "</a>"; }).join("") +
      '<div class="btn-row" style="margin-top:24px"><a class="btn btn--primary" href="/halorides-preview/en/download">Get the app</a>' +
      '<a class="btn btn--ghost" href="/halorides-preview/en/signup">Sign in</a></div>';
    btn.addEventListener("click", function () {
      menuOpen = !menuOpen;
      btn.setAttribute("aria-expanded", String(menuOpen));
      btn.setAttribute("aria-label", menuOpen ? "Close" : "Menu");
      btn.innerHTML = menuOpen ? ICON_CLOSE : ICON_MENU;
      document.body.style.overflow = menuOpen ? "hidden" : "";
      if (menuOpen) header.after(menu); else menu.remove();
      syncHeader();
    });
    // Keyboard: Escape closes the menu and hands focus back; tabbing out of it closes it too
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menuOpen) { btn.click(); btn.focus(); }
    });
    document.addEventListener("focusin", function (e) {
      if (menuOpen && !menu.contains(e.target) && !header.contains(e.target)) btn.click();
    });
  }

  // Scroll reveal
  var reveals = $$(".reveal");
  if ("IntersectionObserver" in window) {
    reveals.forEach(function (el) {
      var io = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { el.dataset.visible = "true"; io.disconnect(); }
      }, { rootMargin: "0px 0px -10% 0px" });
      io.observe(el);
    });
  } else reveals.forEach(function (el) { el.dataset.visible = "true"; });

  // Keyboard focus landing inside a section that has not faded in yet shows it at once
  document.addEventListener("focusin", function (e) {
    var r = e.target.closest && e.target.closest('.reveal[data-visible="false"]');
    while (r) { r.style.transition = "none"; r.dataset.visible = "true"; r = r.parentElement && r.parentElement.closest('.reveal[data-visible="false"]'); }
  });

  // ── Motion layer ─────────────────────────────────────────────────────────
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Headlines: split into words that rise in one after another
  $$(".hero2__title span, .page-hero .h1").forEach(function (el) {
    var words = el.textContent.trim().split(/\s+/), i = 0;
    // Screen readers get the sentence once, as real text; the animated words are hidden from them
    el.innerHTML = '<span class="vh">' + el.textContent.trim() + "</span>" + words.map(function (w) {
      return '<span class="w" aria-hidden="true"><span style="--i:' + (i++) + '">' + w + "</span></span>";
    }).join('<span aria-hidden="true"> </span>');
    el.setAttribute("data-split", "");
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add("is-in"); }); });
  });
  // Second hero line starts after the first
  var heroLines = $$(".hero2__title span[data-split]");
  if (heroLines[1]) $$(".w > span", heroLines[1]).forEach(function (s, k) { s.style.setProperty("--i", k + 4); });

  // Car Score number counts up with its ring
  $$(".score-ring .num").forEach(function (num) {
    var target = parseInt(num.textContent, 10), host = num.closest(".reveal");
    if (!host || isNaN(target) || reduceMotion || !("IntersectionObserver" in window)) return;
    num.textContent = "0";
    var sio = new IntersectionObserver(function (e) {
      if (!e[0].isIntersecting) return;
      sio.disconnect();
      var t0 = null, dur = 1800;
      setTimeout(function () {
        requestAnimationFrame(function tick(t) {
          if (t0 === null) t0 = t;
          var p = Math.min(1, (t - t0) / dur), eased = 1 - Math.pow(1 - p, 4);
          num.textContent = String(Math.round(target * eased));
          if (p < 1) requestAnimationFrame(tick);
        });
      }, 300);
    }, { rootMargin: "0px 0px -10% 0px" });
    sio.observe(host);
  });

  // Scroll-linked effects: step progress line + gentle image parallax
  var progressList = $(".jsteps[data-progress]");
  var parallaxEls = reduceMotion ? [] : $$("[data-parallax]");
  var fxQueued = false;
  function syncFx() {
    fxQueued = false;
    var vh = window.innerHeight;
    if (progressList) {
      var r = progressList.getBoundingClientRect();
      var p = Math.max(0, Math.min(1, (vh * 0.62 - r.top) / Math.max(1, r.height - 48)));
      progressList.style.setProperty("--progress", p.toFixed(3));
      var items = $$("li", progressList);
      items.forEach(function (li, k) { li.classList.toggle("is-done", k === 0 || p >= k / (items.length - 1) - 0.02); });
    }
    if (window.innerWidth > 900) parallaxEls.forEach(function (el) {
      var host = el.closest("section") || el, hr = host.getBoundingClientRect();
      if (hr.bottom < 0 || hr.top > vh) return;
      var offset = (hr.top + hr.height / 2 - vh / 2) * -parseFloat(el.dataset.parallax);
      el.style.setProperty("--py", offset.toFixed(1) + "px");
    });
    else parallaxEls.forEach(function (el) { el.style.removeProperty("--py"); });
  }
  if (progressList || parallaxEls.length) {
    var queueFx = function () { if (!fxQueued) { fxQueued = true; requestAnimationFrame(syncFx); } };
    window.addEventListener("scroll", queueFx, { passive: true });
    window.addEventListener("resize", queueFx);
    syncFx();
  }

  // Fare breakdown disclosure: opens once when scrolled into view, then user-controlled
  var fareBtn = $(".fare-toggle"), fareLines = $("#fare-lines");
  if (fareBtn && fareLines) {
    var setFare = function (open) {
      fareLines.dataset.open = String(open);
      fareBtn.setAttribute("aria-expanded", String(open));
    };
    fareBtn.addEventListener("click", function () { setFare(fareLines.dataset.open !== "true"); });
    if ("IntersectionObserver" in window) {
      var fio = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { setTimeout(function () { setFare(true); }, 500); fio.disconnect(); }
      }, { threshold: 0.6 });
      fio.observe(fareBtn);
    } else setFare(true);
  }

  // Mobile sticky download CTA: after the hero, hidden again near the final CTA and footer
  var sticky = $(".sticky-cta"), hero2 = $(".hero2") || $(".page-hero"), endZone = $("#get-the-app") || $(".cta-band") || $("footer");
  if (sticky && hero2) {
    var stickyQueued = false;
    var syncSticky = function () {
      stickyQueued = false;
      var pastHero = hero2.getBoundingClientRect().bottom < 0;
      var atEnd = endZone ? endZone.getBoundingClientRect().top < window.innerHeight : false;
      sticky.dataset.show = String(pastHero && !atEnd && !menuOpen);
    };
    var queueSticky = function () { if (!stickyQueued) { stickyQueued = true; requestAnimationFrame(syncSticky); } };
    window.addEventListener("scroll", queueSticky, { passive: true });
    window.addEventListener("resize", queueSticky);
    if (btn) btn.addEventListener("click", function () { setTimeout(syncSticky, 0); });
    syncSticky();
  }

  // Locale select: only English is mirrored
  $$(".locale-select").forEach(function (s) { s.addEventListener("change", function () { s.value = "en"; }); });

  // Segmented toggles
  $$(".segmented").forEach(function (g) {
    $$("button", g).forEach(function (b) {
      b.addEventListener("click", function () {
        $$("button", g).forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      });
    });
  });

  // Forms (mocked)
  function notice(html) { var d = document.createElement("div"); d.className = "notice notice--ok"; d.innerHTML = html; return d; }
  function ref(prefix) { return prefix + "-" + Math.random().toString(36).slice(2, 8).toUpperCase(); }

  $$("form.form").forEach(function (form) {
    if (form.hasAttribute("data-custom")) return; // handled by its own script (e.g. partners.js)
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var submit = $('button[type="submit"]', form);
      var phone = $("#phone", form);

      // Sign-up OTP flow: phone -> code -> done
      if (phone) {
        // analytics: only the event name and role are recorded, never the phone number
        var driverRole = (($('.segmented button[aria-pressed="true"]', form) || {}).textContent || "").toLowerCase().indexOf("drive") !== -1;
        var trackEvt = function (name) {
          if (!driverRole) return;
          if (window.DA && window.DA.track) window.DA.track(name, {}, true);
          else (window.dataLayer = window.dataLayer || []).push({ event: name });
        };
        if (!$("#code", form)) {
          trackEvt("driver_signup_start");
          phone.disabled = true;
          var f = document.createElement("div");
          f.className = "field";
          f.innerHTML = '<label for="code">Verification code</label><input class="input" id="code" inputmode="numeric" autocomplete="one-time-code" pattern="\\d{6}" maxlength="6" required style="letter-spacing:0.4em;font-size:20px">';
          phone.closest(".field").after(f);
          $("#code", f).addEventListener("input", function (ev) { ev.target.value = ev.target.value.replace(/\D/g, ""); });
          $("#code", f).focus();
          submit.textContent = "Verify";
        } else {
          var wrap = document.createElement("div");
          wrap.className = "stack";
          wrap.appendChild(notice("You’re in. Download the app and sign in with the same number to continue."));
          form.replaceWith(wrap);
          trackEvt("driver_signup_complete");
        }
        return;
      }

      var label = submit ? submit.textContent : "";
      if (submit) { submit.disabled = true; submit.textContent = "Sending…"; }
      setTimeout(function () {
        var n;
        if ($("#ch-service", form) || /quote/i.test(label)) {
          var code = ref("CH");
          n = notice("<strong>Request received</strong><p style=\"margin:6px 0 12px\">Your reference is " + code +
            ". Our team will contact you shortly with a quote.</p><button type=\"button\" class=\"btn btn--ghost btn--sm\">Make another request</button>");
          $("button", n).addEventListener("click", function () {
            form.reset(); if (submit) { submit.disabled = false; submit.textContent = label; } n.replaceWith(form);
          });
        } else if ($("#s-name", form)) {
          n = notice("Thanks. Your reference is " + ref("SUP") + ". We have emailed you a copy and will reply there.");
        } else {
          n = notice("Thank you — we’ll be in touch shortly.");
        }
        form.replaceWith(n);
      }, 500);
    });
  });
})();
