import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getLazyRouteComponent, recoverMissingLazyRoute } from "./lazy-route-module.ts";

describe("getLazyRouteComponent", () => {
  it("returns the default export when present", () => {
    const Page = () => null;
    assert.equal(getLazyRouteComponent({ default: Page }), Page);
  });

  it("unwraps a function module (CJS / Vite interop)", () => {
    const Page = () => null;
    assert.equal(getLazyRouteComponent(Page), Page);
  });

  it("returns undefined when the module is missing or has no default", () => {
    assert.equal(getLazyRouteComponent(undefined), undefined);
    assert.equal(getLazyRouteComponent(null), undefined);
    assert.equal(getLazyRouteComponent({}), undefined);
  });
});

describe("recoverMissingLazyRoute", () => {
  it("waits when a reload was already started this page (vite:preloadError preventDefault)", () => {
    assert.equal(recoverMissingLazyRoute(true, () => false), "wait");
  });

  it("waits when it can start a stale-chunk reload", () => {
    assert.equal(recoverMissingLazyRoute(false, () => true), "wait");
  });

  it("throws when no reload is in flight or available", () => {
    assert.equal(recoverMissingLazyRoute(false, () => false), "throw");
  });
});
