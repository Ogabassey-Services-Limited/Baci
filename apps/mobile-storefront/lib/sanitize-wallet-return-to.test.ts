import { describe, expect, it } from "@jest/globals";
import type { Href } from "expo-router";
import { sanitizeWalletReturnTo } from "./sanitize-wallet-return-to";

function acceptNavigationHref(_href: Href) {}

describe("sanitizeWalletReturnTo", () => {
  it.each(["/", "/imei-check", "/wallet/history"])(
    "keeps valid wallet return path %s",
    (value) => {
      expect(sanitizeWalletReturnTo(value)).toBe(value);
    },
  );

  it("returns a destination accepted by Expo Router typed routes", () => {
    const returnTo = sanitizeWalletReturnTo("/imei-check");

    expect(returnTo).toBe("/imei-check");
    if (returnTo) {
      acceptNavigationHref(returnTo);
    }
  });

  it.each([
    "",
    "https://evil.com",
    "//evil.com",
    "/a/../b",
    "/a/..",
    "/a/./b",
    "/a/.",
    "/a%2fb",
    "/A%2Fb",
    "/%252f",
    "/a\\b",
    "/a%5cb",
    "/%E0%A4%A",
    ["/", "/wallet"],
    null,
    undefined,
    123,
    false,
  ])("rejects unsafe wallet return value %#", (value) => {
    expect(sanitizeWalletReturnTo(value)).toBeUndefined();
  });
});
