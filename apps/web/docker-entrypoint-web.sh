#!/bin/sh
set -eu

CERT_DIR="/etc/nginx/certs"
CERT_FILE="${CERT_DIR}/fullchain.pem"
KEY_FILE="${CERT_DIR}/privkey.pem"

mkdir -p "${CERT_DIR}"

if [ ! -s "${CERT_FILE}" ] || [ ! -s "${KEY_FILE}" ]; then
  echo "[web] TLS cert not found, generating self-signed cert..."
  openssl req -x509 -nodes -newkey rsa:2048 \
    -keyout "${KEY_FILE}" \
    -out "${CERT_FILE}" \
    -days 365 \
    -subj "/C=CN/ST=Local/L=Local/O=Yisu/OU=Web/CN=localhost"
fi

exec nginx -g "daemon off;"
