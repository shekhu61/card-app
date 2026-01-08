let token = null;
let expiry = null;

export function getToken() {
  if (token && expiry && Date.now() < expiry) {
    return token;
  }
  return null;
}

export function setToken(newToken, expiresInSeconds = 3600) {
  token = newToken;
  expiry = Date.now() + expiresInSeconds * 1000;
}
