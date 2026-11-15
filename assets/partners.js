/* HaloRide Partners: category preselection, adaptive enquiry fields, inline validation, analytics.
 *
 * The enquiry form is MOCKED in this static clone: nothing is sent anywhere.
 * To go live, replace the body of send() with a call to the real lead endpoint or CRM
 * (see docs/PARTNERS-REPORT.md). Analytics events carry no names, emails, phone numbers or free text.
 */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var CATEGORIES = ["fleet", "garage", "insurance", "corporate", "finance", "institution", "other"];

  function track(name, props) {
    var payload = { event: name };
    for (var k in (props || {})) payload[k] = props[k];
    (window.dataLayer = window.dataLayer || []).push(payload);
    try { document.dispatchEvent(new CustomEvent("halo:track", { detail: payload })); } catch (e) {}
  }

  // Lead source: an explicit ?source= value, else the referring page's path on this site, else "direct".
  function leadSource() {
    var q = new URLSearchParams(location.search).get("source");
    if (q && /^[a-z0-9_-]{1,40}$/i.test(q)) return q;
    try {
      if (document.referrer) {
        var u = new URL(document.referrer);
        return u.host === location.host ? "internal:" + u.pathname : "external";
      }
    } catch (e) {}
    return "direct";
  }

  function init() {
    var form = $("[data-pt-form]");
    if (!form) return;
    var select = $("#pt-category", form), summary = $("[data-pt-summary]", form), submit = $('button[type="submit"]', form);
    var source = leadSource(), started = false;

    track("partner_page_view", { source: source });

    function showFields(cat) {
      $$("[data-pt-fields]", form).forEach(function (fs) {
        var on = fs.getAttribute("data-pt-fields") === cat;
        fs.hidden = !on;
        $$("input, textarea, select", fs).forEach(function (el) { el.disabled = !on; });
      });
    }
    function setCategory(cat, via) {
      if (CATEGORIES.indexOf(cat) === -1) return;
      select.value = cat;
      showFields(cat);
      clearError(select);
      track("partner_category_select", { category: cat, via: via });
    }

    select.addEventListener("change", function () {
      showFields(select.value);
      if (select.value) track("partner_category_select", { category: select.value, via: "form" });
    });

    // ── category panels: one open at a time ─────────────────────────────────
    var tabs = $$("[data-pt-tab]"), wide = window.matchMedia("(min-width: 961px)");
    var panelOf = function (b) { return document.getElementById(b.getAttribute("aria-controls")); };
    function openPanel(key, via) {
      var found = false;
      tabs.forEach(function (b) {
        var on = b.getAttribute("data-pt-tab") === key;
        b.setAttribute("aria-expanded", String(on)); panelOf(b).hidden = !on;
        if (on) found = true;
      });
      if (found && via) track("partner_category_view", { category: key, via: via });
      return found;
    }
    if (tabs.length) {
      var fromHash = /^#p-([a-z]+)$/.exec(location.hash);
      if (!(fromHash && openPanel(fromHash[1], "url"))) openPanel(tabs[0].getAttribute("data-pt-tab"));
      tabs.forEach(function (b) {
        b.addEventListener("click", function () {
          var key = b.getAttribute("data-pt-tab");
          // on phones the open category can be folded away again; on wide screens one always stays open
          if (b.getAttribute("aria-expanded") === "true") { if (!wide.matches) openPanel(""); return; }
          openPanel(key, "tab");
        });
      });
      // links to a category (the ecosystem diagram) open its panel and move to it
      document.addEventListener("click", function (e) {
        var a = e.target.closest && e.target.closest('a[href^="#p-"]');
        if (!a) return;
        var key = a.getAttribute("href").slice(3), b = document.getElementById("pt-tab-" + key);
        if (!b || !openPanel(key, "link")) return;
        e.preventDefault();
        b.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
        b.focus({ preventScroll: true });
      });
    }

    // Category CTAs and every tracked link
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("[data-pt-cta]");
      if (!a) return;
      var cat = a.getAttribute("data-pt-category");
      track("partner_cta_click", { cta: a.getAttribute("data-pt-cta"), category: cat || undefined });
      if (cat) setCategory(cat, "cta");
    });

    // Arriving with a category already chosen: /halorides-preview/en/partners?category=fleet#enquiry
    var pre = new URLSearchParams(location.search).get("category");
    if (pre) setCategory(pre, "url");

    // "Start" = the first time someone focuses, types in or changes any field (autofill counts)
    function start() {
      if (started) return;
      started = true;
      track("partner_form_start", { category: select.value || "none", source: source });
    }
    ["focusin", "input", "change"].forEach(function (t) { form.addEventListener(t, start); });

    // ── validation ──────────────────────────────────────────────────────────
    var MESSAGES = {
      "pt-category": "Choose a partnership category.",
      "pt-org": "Enter your organisation’s name.",
      "pt-name": "Enter a contact name.",
      "pt-email": "Enter a business email address, like name@company.com.",
      "pt-phone": "Enter a phone number we can reach you on.",
      "pt-city": "Enter the city or location you operate in.",
      "pt-offer": "Tell us briefly what your organisation offers.",
      "pt-opportunity": "Tell us briefly what you’d like to explore."
    };
    function errorEl(el) {
      var id = el.id + "-error", p = document.getElementById(id);
      if (!p) {
        p = document.createElement("p"); p.id = id; p.className = "pt-error"; p.hidden = true;
        el.closest(".field").appendChild(p);
      }
      return p;
    }
    function clearError(el) {
      el.removeAttribute("aria-invalid"); el.removeAttribute("aria-describedby");
      var p = document.getElementById(el.id + "-error"); if (p) p.hidden = true;
    }
    function check(el) {
      var v = (el.value || "").trim(), bad = false;
      if (el.required && !v) bad = true;
      else if (el.type === "email" && v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) bad = true;
      else if (el.type === "tel" && v && v.replace(/\D/g, "").length < 7) bad = true;
      if (!bad) { clearError(el); return true; }
      var p = errorEl(el);
      p.textContent = MESSAGES[el.id] || "Check this field."; p.hidden = false;
      el.setAttribute("aria-invalid", "true"); el.setAttribute("aria-describedby", p.id);
      return false;
    }
    var required = function () { return $$("[required]", form).filter(function (el) { return !el.disabled; }); };
    required().forEach(function (el) {
      el.addEventListener("blur", function () { if ((el.value || "").trim() || el.getAttribute("aria-invalid")) check(el); });
      el.addEventListener("input", function () { if (el.getAttribute("aria-invalid")) check(el); });
    });

    // Stand-in for the real lead endpoint. Nothing leaves the browser.
    function send() { return new Promise(function (resolve) { setTimeout(resolve, 600); }); }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if ($('[name="website"]', form).value) return; // honeypot: bots fill it, people never see it
      if (form.getAttribute("aria-busy") === "true") return; // already sending: never submit twice
      var bad = required().filter(function (el) { return !check(el); });
      if (bad.length) {
        summary.hidden = false;
        summary.textContent = bad.length === 1 ? "There is 1 field to fix before you can submit." : "There are " + bad.length + " fields to fix before you can submit.";
        bad[0].focus();
        track("partner_form_error", { category: select.value || "none", fields: bad.map(function (el) { return el.name; }).join(","), count: bad.length });
        return;
      }
      summary.hidden = true;
      var label = submit.textContent, category = select.value;
      submit.disabled = true; submit.textContent = "Sending…"; form.setAttribute("aria-busy", "true");
      send().then(function () {
        var done = document.createElement("div");
        done.className = "notice notice--ok pt-done"; done.setAttribute("role", "status"); done.tabIndex = -1;
        done.innerHTML = "<strong>Enquiry received</strong><p style=\"margin:6px 0 0\">Thank you for your interest in partnering with HaloRide. We’ve received your enquiry and will review it to understand where our organisations may align.</p>";
        form.replaceWith(done);
        done.focus();
        track("partner_form_complete", { category: category, source: source });
      }, function () {
        submit.disabled = false; submit.textContent = label; form.removeAttribute("aria-busy");
        summary.hidden = false; summary.textContent = "We couldn’t send your enquiry. Please try again.";
        track("partner_form_error", { category: category, fields: "network", count: 0 });
      });
    });

    $$("[data-pt-faq] details").forEach(function (d, i) {
      d.addEventListener("toggle", function () { if (d.open) track("partner_faq_open", { question: i + 1 }); });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
