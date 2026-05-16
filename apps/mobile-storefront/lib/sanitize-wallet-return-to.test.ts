import { describe, expect, it } from "@jest/globals";
import { sanitizeWalletReturnTo } from "./sanitize-wallet-return-to";

describe("sanitizeWalletReturnTo", () => {
  it.each(["/", "/imei-check", "/wallet/history"])(
    "keeps valid wallet return path %s",
    (value) => {
      expect(sanitizeWalletReturnTo(value)).toBe(value);
    },
  );

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
