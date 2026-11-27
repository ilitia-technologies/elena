/**
 * Store rules shared by the system prompt (server) and the components (web), so what Elena is told
 * and what the screens calculate cannot drift apart.
 */

/** Electricity price for running costs, in EUR per kWh. */
export const KWH_PRICE_EUR = 0.18;

/** Financing: interest-free up to `interestFreeMonths`; longer terms at `tin` % TIN. */
export const FINANCING = {interestFreeMonths: 12, tin: 7.95, terms: [3, 6, 12, 24, 36]} as const;

/** Discount the Bundle component applies to packs of `minItems` products or more. */
export const BUNDLE_DISCOUNT = {minItems: 3, rate: 0.05} as const;

/** Conversation turns the client sends back as history and the server keeps. */
export const HISTORY_TURNS = 3;
