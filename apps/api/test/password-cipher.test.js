const test = require("node:test");
const assert = require("node:assert/strict");

const {
  resolvePasswordCipher,
  sha256Hex,
} = require("../lib/password-cipher");

test("resolvePasswordCipher prefers passwordCipher over plaintext password", () => {
  assert.equal(
    resolvePasswordCipher({
      passwordCipher: "cipher-value",
      password: "Plain#123",
    }),
    "cipher-value",
  );
});

test("resolvePasswordCipher hashes plaintext password when cipher is absent", () => {
  assert.equal(
    resolvePasswordCipher({ password: "Plain#123" }),
    sha256Hex("Plain#123"),
  );
});

test("resolvePasswordCipher returns empty string when both inputs are missing", () => {
  assert.equal(resolvePasswordCipher({}), "");
});
