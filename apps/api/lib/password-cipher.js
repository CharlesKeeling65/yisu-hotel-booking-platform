const crypto = require("crypto");

function sha256Hex(input) {
  return crypto
    .createHash("sha256")
    .update(String(input || ""))
    .digest("hex");
}

function resolvePasswordCipher(payload = {}) {
  const cipher = String(payload.passwordCipher || "").trim();
  if (cipher) return cipher;

  const password = String(payload.password || "");
  return password ? sha256Hex(password) : "";
}

module.exports = {
  sha256Hex,
  resolvePasswordCipher,
};
