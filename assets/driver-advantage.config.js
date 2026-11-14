/* HaloRide Driver Advantage: single source of truth for programme status and figures.
 *
 * status values:
 *   "confirmed"  programme confirmed but not yet live. Shown as "Coming soon"; every figure is illustrative. No launch date, no eligibility language.
 *   "pilot"    limited rollout. Set pilotScope to the approved population or markets.
 *   "active"   live. Requires confirmed terms (and, for Trip Protection, a full insurer record below).
 *   "paused"   enrolment messaging is hidden and a paused notice is shown.
 *
 * Safeguard: a benefit set to "pilot" or "active" without its required details is rendered as "confirmed".
 * Do not change a status, add an insurer, or edit a figure without commercial and legal sign-off.
 */
window.DRIVER_ADVANTAGE = {
  programmeStatus: "confirmed",
  pilotScope: "", // e.g. "selected drivers in Lagos" (only shown when a status is "pilot")

  tripProtection: {
    status: "confirmed",
    // Leave every field empty until an insurer-approved schedule exists. Nothing here is shown while empty.
    insurerName: "",
    policyId: "",
    coverageStart: "",
    coverageEnd: "",
    medicalExpenseLimit: "",
    disabilityDeathLimit: "",
    incomeInterruptionTerms: "",
    exclusions: "",
    claimsContact: "",
    geography: "",
    policyUrl: ""
  },

  carCare: {
    status: "confirmed",
    accrualPerTrip: 150,   // naira per qualifying paid trip
    eligibilityTrips: 200, // qualifying trips needed within the period
    eligibilityDays: 90,
    quarterlyCap: 45000    // maximum credit per period, naira
  },

  rewardDays: {
    status: "confirmed",
    commissionRate: 0.2,   // standard HaloRide commission
    eligibleTrips: 4,      // commission-free trips per reward day
    maximumWaiver: 16000,  // maximum commission waived per reward day, naira
    exampleFare: 20000     // starting point for the illustration, naira
  }
};
