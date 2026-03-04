const API_BASE = import.meta.env.VITE_API_URL || '';

let getTokenFn = null;

/**
 * Set the function used to acquire MSAL access tokens.
 * Called once from the MsalProvider wrapper.
 */
export function setTokenAcquirer(fn) {
  getTokenFn = fn;
}

async function getHeaders() {
  const headers = { 'Content-Type': 'application/json' };

  if (getTokenFn) {
    try {
      const token = await getTokenFn();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        return headers;
      }
    } catch {
      // If token acquisition fails, fall through to dev bypass
    }
  }

  // In development, use dev auth bypass when no MSAL token is available
  if (import.meta.env.DEV) {
    headers['Authorization'] = `Bearer dev:john.doe@company.com`;
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
  patch:  (path, data) => request(path, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (path)       => request(path, { method: 'DELETE' }),
};
