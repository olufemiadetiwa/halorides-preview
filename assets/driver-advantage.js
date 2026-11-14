/* HaloRide Driver Advantage: status rendering, illustrative calculators, disclosure panel, analytics.
 * Reads window.DRIVER_ADVANTAGE (driver-advantage.config.js). Pure maths lives on window.DA for testing. */
(function () {
  "use strict";
  var DEFAULTS = {
    programmeStatus: "confirmed", pilotScope: "",
    tripProtection: { status: "confirmed" },
    carCare: { status: "confirmed", accrualPerTrip: 150, eligibilityTrips: 200, eligibilityDays: 90, quarterlyCap: 45000 },
    rewardDays: { status: "confirmed", commissionRate: 0.2, eligibleTrips: 4, maximumWaiver: 16000, exampleFare: 20000 }
  };
  var VALID = ["confirmed", "pilot", "active", "paused"];
  var raw = window.DRIVER_ADVANTAGE || {};
  function merge(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in (b || {})) if (b[k] !== undefined && b[k] !== null) o[k] = b[k]; return o; }
  var cfg = merge(DEFAULTS, raw);
  cfg.tripProtection = merge(DEFAULTS.tripProtection, raw.tripProtection);
  cfg.carCare = merge(DEFAULTS.carCare, raw.carCare);
  cfg.rewardDays = merge(DEFAULTS.rewardDays, raw.rewardDays);

  // ── maths (no DOM) ────────────────────────────────────────────────────────
  function num(v, fallback) { v = Number(v); return isFinite(v) && v >= 0 ? v : fallback; }
  function carCare(trips, c) {
    c = c || cfg.carCare;
    trips = Math.floor(num(trips, 0));
    var cap = num(c.quarterlyCap, 0), per = num(c.accrualPerTrip, 0), threshold = num(c.eligibilityTrips, 0);
    var accrued = Math.min(trips * per, cap);
    var capTrips = per > 0 ? Math.ceil(cap / per) : 0;
    var state = trips < threshold ? "below" : (accrued >= cap && cap > 0 ? "max" : "eligible");
    return { trips: trips, accrued: accrued, state: state, eligible: state !== "below", capTrips: capTrips, tripsToThreshold: Math.max(0, threshold - trips) };
  }
  function rewardDay(fare, c) {
    c = c || cfg.rewardDays;
    fare = num(fare, 0);
    var trips = Math.floor(num(c.eligibleTrips, 0)), rate = Math.min(1, num(c.commissionRate, 0)), cap = num(c.maximumWaiver, 0);
    var total = fare * trips;                       // only the reward-eligible trips are counted
    var commission = Math.round(total * rate);
    var waived = Math.min(commission, cap);         // reward = min(eligibleFareTotal * commissionRate, rewardCap)
    return { fare: fare, trips: trips, totalFares: total, commission: commission, waived: waived, capped: commission > cap,
             normalReceipts: total - commission, rewardCommission: commission - waived, rewardReceipts: total - (commission - waived) };
  }
  // A benefit cannot present as pilot/active without the details that make that true.
  function effectiveStatus(key) {
    var s = key === "programme" ? cfg.programmeStatus : (cfg[key] || {}).status;
    if (VALID.indexOf(s) === -1) return "confirmed";
    if (s === "pilot" && !String(cfg.pilotScope || "").trim()) return "confirmed";
    if (key === "tripProtection" && (s === "pilot" || s === "active")) {
      var t = cfg.tripProtection, need = ["insurerName", "policyId", "coverageStart", "coverageEnd", "claimsContact", "policyUrl"];
      for (var i = 0; i < need.length; i++) if (!String(t[need[i]] || "").trim()) return "confirmed";
    }
    if (key === "programme" && s === "active") {
      // the programme is only "active" if at least one benefit genuinely is
      var any = ["tripProtection", "carCare", "rewardDays"].some(function (k) { return effectiveStatus(k) === "active"; });
      if (!any) return "confirmed";
    }
    return s;
  }
  function naira(n) { return "₦" + Math.round(n).toLocaleString("en-NG"); }

  // ── analytics (no network: events go to window.dataLayer and a DOM event) ──
  var fired = {};
  function track(name, props, once) {
    if (once && fired[name]) return;
    fired[name] = true;
    var payload = { event: name };
    for (var k in (props || {})) payload[k] = props[k];
    (window.dataLayer = window.dataLayer || []).push(payload);
    try { document.dispatchEvent(new CustomEvent("halo:track", { detail: payload })); } catch (e) {}
  }
  window.DA = { config: cfg, carCare: carCare, rewardDay: rewardDay, effectiveStatus: effectiveStatus, naira: naira, track: track };

  // ── DOM ───────────────────────────────────────────────────────────────────
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var CHIP = { confirmed: "Coming soon", pilot: "Pilot", active: "Available now", paused: "Paused" };
  var BENEFIT_CHIP = { confirmed: "Coming soon", pilot: "Pilot", active: "Live", paused: "Paused" };

  function init() {
    var programme = effectiveStatus("programme");
    document.body.setAttribute("data-da-programme", programme);

    $$("[data-da-chip]").forEach(function (el) {
      var key = el.getAttribute("data-da-chip"), s = effectiveStatus(key);
      el.setAttribute("data-status", s);
      el.textContent = (key === "programme" ? CHIP : BENEFIT_CHIP)[s];
    });

    var banner = $("[data-da-banner]");
    if (banner) {
      var scope = String(cfg.pilotScope || "").trim();
      var text = {
        confirmed: ["Coming soon.", "Driver Advantage is confirmed and on its way. Benefits are not open to drivers yet, and every figure on this page is an illustration until final terms are published."],
        pilot: ["Pilot.", "Driver Advantage is being piloted with " + scope + ". Benefits are limited to pilot participants and are not available to all drivers."],
        active: ["Available now.", "Benefits marked Live are open to eligible drivers under the published programme terms. Others are coming soon."],
        paused: ["Paused.", "Driver Advantage is paused. No new enrolments are being taken, and this page will be updated when that changes."]
      }[programme];
      banner.setAttribute("data-status", programme);
      banner.innerHTML = '<div class="container"><p style="margin:0"><strong>' + text[0] + "</strong> " + text[1] + "</p></div>";
    }

    // figures in running copy come from the config, never hard-coded twice
    var cc = cfg.carCare, rd = cfg.rewardDays;
    var vals = {
      accrual: naira(cc.accrualPerTrip), threshold: String(cc.eligibilityTrips), days: String(cc.eligibilityDays), cap: naira(cc.quarterlyCap),
      capTrips: String(carCare(1e9).capTrips), thresholdCredit: naira(carCare(cc.eligibilityTrips).accrued),
      rate: Math.round(rd.commissionRate * 100) + "%", rewardTrips: String(rd.eligibleTrips), waiver: naira(rd.maximumWaiver)
    };
    $$("[data-da]").forEach(function (el) { var v = vals[el.getAttribute("data-da")]; if (v !== undefined) el.textContent = v; });

    initCarCare(); initReward(); initDisclosure();

    if ($("[data-da-page]")) track("driver_advantage_view", { programme_status: programme }, true);
    document.addEventListener("click", function (e) {
      var cta = e.target.closest && e.target.closest("[data-da-cta]");
      if (cta) track("driver_advantage_cta_click", { cta: cta.getAttribute("data-da-cta") });
    });
    $$("[data-da-faq] details").forEach(function (d, i) {
      d.addEventListener("toggle", function () { if (d.open) track("driver_advantage_faq_open", { question: i + 1 }); });
    });
    var tp = $("#trip-protection");
    if (tp && "IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { track("trip_protection_expand", {}, true); io.disconnect(); } }, { threshold: 0.3 });
      io.observe(tp);
    }
  }

  function fillRange(input) {
    var min = Number(input.min), max = Number(input.max);
    input.style.setProperty("--fill", ((Number(input.value) - min) / (max - min) * 100) + "%");
  }

  function initCarCare() {
    var root = $("[data-da-carcare]"); if (!root) return;
    var input = $("input[type=range]", root), cc = cfg.carCare;
    var maxTrips = Number(input.max);
    var out = { trips: $("[data-out=trips]", root), amount: $("[data-out=amount]", root), state: $("[data-out=state]", root), hint: $("[data-out=hint]", root),
                fill: $(".da-meter__fill", root), meter: $(".da-meter", root) };
    $(".da-meter__mark--threshold", root).style.left = (cc.eligibilityTrips / maxTrips * 100) + "%";
    $(".da-meter__mark--cap", root).style.left = (Math.min(carCare(1e9).capTrips, maxTrips) / maxTrips * 100) + "%";
    var LABEL = { below: "Below eligibility threshold", eligible: "Eligible", max: "Maximum reached" };
    function render() {
      var r = carCare(input.value);
      out.trips.textContent = r.trips.toLocaleString("en-NG") + " trips";
      out.amount.textContent = naira(r.accrued);
      out.state.textContent = LABEL[r.state]; out.state.setAttribute("data-state", r.state);
      out.meter.setAttribute("data-state", r.state);
      out.fill.style.width = (r.trips / maxTrips * 100) + "%";
      out.hint.textContent = r.state === "below"
        ? r.tripsToThreshold.toLocaleString("en-NG") + " more qualifying trips to reach the threshold. Until then the credit accrues but cannot be used."
        : r.state === "max" ? "The quarterly maximum is reached. Further trips in this period would not add more credit."
        : "Past the threshold. In this model the credit could go towards approved maintenance at a participating garage.";
      input.setAttribute("aria-valuetext", r.trips + " trips, " + naira(r.accrued) + ", " + LABEL[r.state]);
      fillRange(input);
    }
    input.addEventListener("input", function () { render(); track("car_care_calculator_interaction", {}, true); });
    render();
  }

  function initReward() {
    var root = $("[data-da-reward]"); if (!root) return;
    var input = $("input[type=range]", root);
    input.value = cfg.rewardDays.exampleFare;
    var o = function (k) { return $("[data-out=" + k + "]", root); };
    function render() {
      var r = rewardDay(input.value);
      o("fare").textContent = naira(r.fare);
      $$("[data-out=total]", root).forEach(function (el) { el.textContent = naira(r.totalFares); });
      o("n-commission").textContent = "− " + naira(r.commission);
      o("n-receipts").textContent = naira(r.normalReceipts);
      o("r-commission").textContent = r.rewardCommission ? "− " + naira(r.rewardCommission) : naira(0);
      o("r-receipts").textContent = naira(r.rewardReceipts);
      o("gain").textContent = naira(r.waived);
      var cap = o("cap"); cap.hidden = !r.capped;
      if (r.capped) cap.textContent = "At this fare the commission on " + r.trips + " trips would be " + naira(r.commission) + ". The waiver stops at the " + naira(cfg.rewardDays.maximumWaiver) + " maximum, so " + naira(r.rewardCommission) + " of commission still applies.";
      input.setAttribute("aria-valuetext", naira(r.fare) + " per trip, " + naira(r.waived) + " additional receipts");
      fillRange(input);
    }
    input.addEventListener("input", function () { render(); track("reward_day_calculator_interaction", {}, true); });
    render();
  }

  function initDisclosure() {
    var el = $("[data-da-disclosure]"); if (!el) return;
    var t = cfg.tripProtection, s = effectiveStatus("tripProtection");
    var rows = [["Licensed insurer", t.insurerName], ["Policy identifier", t.policyId], ["Coverage period", t.coverageStart && t.coverageEnd ? t.coverageStart + " to " + t.coverageEnd : ""],
      ["Medical expense limit", t.medicalExpenseLimit], ["Disability and death benefit limit", t.disabilityDeathLimit], ["Income interruption", t.incomeInterruptionTerms],
      ["Exclusions", t.exclusions], ["Where cover applies", t.geography], ["Claims contact", t.claimsContact]];
    var body = $("[data-da-disclosure-body]", el);
    if (s === "confirmed" || s === "paused") {
      body.innerHTML = '<p class="da-disclosure__preview">' + (s === "paused" ? "Trip Protection is paused. Policy details will be shown here if it resumes."
        : "Insurance partner and final coverage terms will be published before launch.") + "</p>";
      return;
    }
    var esc = function (v) { return String(v).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
    var html = "<dl>" + rows.filter(function (r) { return String(r[1] || "").trim(); }).map(function (r) { return "<div><dt>" + r[0] + "</dt><dd>" + esc(r[1]) + "</dd></div>"; }).join("") + "</dl>";
    if (/^https?:\/\//.test(t.policyUrl || "")) html += '<p style="margin:16px 0 0"><a class="link-arrow" href="' + esc(t.policyUrl) + '" rel="noopener">Read the complete policy wording</a></p>';
    body.innerHTML = html;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
