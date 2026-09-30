import assert from "node:assert/strict";
import { test } from "node:test";
import { isAllowedOrigin } from "../../worker/auth/origin.ts";

const config = {
  PUBLIC_ORIGIN: "https://questacademy.bookwyrminteractive.studio",
  ADDITIONAL_PUBLIC_ORIGINS: "https://questacademy-staging.coxsonator.workers.dev",
};

test("normal domain and existing staging origin pass the same origin guard", () => {
  assert.equal(isAllowedOrigin(config.PUBLIC_ORIGIN, config), true);
  assert.equal(isAllowedOrigin(config.ADDITIONAL_PUBLIC_ORIGINS, config), true);
  assert.equal(isAllowedOrigin(config.ADDITIONAL_PUBLIC_ORIGINS, { PUBLIC_ORIGIN: config.PUBLIC_ORIGIN }), false);
});

test("missing, opaque, unrelated, and lookalike origins remain forbidden", () => {
  for (const origin of [null, "", "null", "https://evil.example", "http://questacademy.bookwyrminteractive.studio", "https://questacademy.bookwyrminteractive.studio.evil.example", "https://questacademy.bookwyrminteractive.studio:8443"]) {
    assert.equal(isAllowedOrigin(origin, config), false, String(origin));
  }
});
