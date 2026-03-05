const API_BASE = import.meta.env.VITE_API_URL || '';

let getTokenFn = null;
let devEmail = null;

/**
 * Set the function used to acquire MSAL access tokens.
 * Called once from the MsalProvider wrapper.
 */
export function setTokenAcquirer(fn) {
  getTokenFn = fn;
}

/**
 * Set the dev bypass email for non-production auth.
 * When set, API requests use `Bearer dev:<email>` instead of MSAL tokens.
 */
export function setDevEmail(email) {
  devEmail = email;
}

async function getHeaders() {
  const headers = { 'Content-Type': 'application/json' };

  // Dev mode: use dev bypass token
  if (devEmail) {
    headers['Authorization'] = `Bearer dev:${devEmail}`;
    return headers;
  }

  // Production: acquire MSAL token
  if (getTokenFn) {
    try {
      const token = await getTokenFn();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        return headers;
      }
    } catch {
      // If token acquisition fails, return headers without auth
    }
  }

  return headers;
}

async function request(path, options = {}) {
  const headers = await getHeaders();
  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    const err = new Error(body.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

export const api = {
  get:    (path)       => request(path),
  post:   (path, data) => request(path, { method: 'POST', body: JSON.stringify(data) }),
  put:    (path, data) => request(path, { method: 'PUT', body: JSON.stringify(data) }),
  patch:  (path, data) => request(path, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (path)       => request(path, { method: 'DELETE' }),
};
