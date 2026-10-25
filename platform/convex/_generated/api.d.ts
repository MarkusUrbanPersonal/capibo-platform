/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as apiKeys from "../apiKeys.js";
import type * as auth from "../auth.js";
import type * as billing from "../billing.js";
import type * as collection from "../collection.js";
import type * as collector from "../collector.js";
import type * as crons from "../crons.js";
import type * as datasets from "../datasets.js";
import type * as demo from "../demo.js";
import type * as exports from "../exports.js";
import type * as http from "../http.js";
import type * as lib_collectorRest from "../lib/collectorRest.js";
import type * as lib_crypto from "../lib/crypto.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_events from "../lib/events.js";
import type * as lib_missions from "../lib/missions.js";
import type * as lib_orgs from "../lib/orgs.js";
import type * as lib_pricing from "../lib/pricing.js";
import type * as lib_rest from "../lib/rest.js";
import type * as lib_serialize from "../lib/serialize.js";
import type * as lib_usage from "../lib/usage.js";
import type * as lib_validate from "../lib/validate.js";
import type * as lib_visuals from "../lib/visuals.js";
import type * as missions from "../missions.js";
import type * as planner from "../planner.js";
import type * as seed from "../seed.js";
import type * as team from "../team.js";
import type * as usage from "../usage.js";
import type * as v1 from "../v1.js";
import type * as webhooks from "../webhooks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  apiKeys: typeof apiKeys;
  auth: typeof auth;
  billing: typeof billing;
  collection: typeof collection;
  collector: typeof collector;
  crons: typeof crons;
  datasets: typeof datasets;
  demo: typeof demo;
  exports: typeof exports;
  http: typeof http;
  "lib/collectorRest": typeof lib_collectorRest;
  "lib/crypto": typeof lib_crypto;
  "lib/errors": typeof lib_errors;
  "lib/events": typeof lib_events;
  "lib/missions": typeof lib_missions;
  "lib/orgs": typeof lib_orgs;
  "lib/pricing": typeof lib_pricing;
  "lib/rest": typeof lib_rest;
  "lib/serialize": typeof lib_serialize;
  "lib/usage": typeof lib_usage;
  "lib/validate": typeof lib_validate;
  "lib/visuals": typeof lib_visuals;
  missions: typeof missions;
  planner: typeof planner;
  seed: typeof seed;
  team: typeof team;
  usage: typeof usage;
  v1: typeof v1;
  webhooks: typeof webhooks;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
