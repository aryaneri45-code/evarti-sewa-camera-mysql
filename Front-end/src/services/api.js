const apiRoot = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
let csrfToken = '';
const imageCredentials = apiRoot && new URL(apiRoot, window.location.origin).origin !== window.location.origin
  ? 'use-credentials'
  : undefined;

function buildQueryString(params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== '' && value !== 'all' && value != null) query.set(key, value);
  }
  return query.size ? `?${query.toString()}` : '';
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (csrfToken && !['GET', 'HEAD', 'OPTIONS'].includes((options.method || 'GET').toUpperCase())) {
    headers.set('X-CSRF-Token', csrfToken);
  }
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${apiRoot}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });
  if (!response.ok) {
    let message = `Permintaan gagal (${response.status}).`;
    let code = 'REQUEST_FAILED';
    try {
      const body = await response.json();
      message = body.error?.message || message;
      code = body.error?.code || code;
    } catch {
      // Keep the HTTP status message when the server did not return JSON.
    }
    const error = new Error(message);
    error.status = response.status;
    error.code = code;
    if (response.status === 401) {
      csrfToken = '';
      window.dispatchEvent(new CustomEvent('evarti:unauthorized'));
    }
    throw error;
  }
  if (response.status === 204) return null;
  if (response.headers.get('content-type')?.includes('application/pdf')) return response.blob();
  if (response.headers.get('content-type')?.startsWith('image/')) return response.blob();
  return response.json();
}

export const api = {
  async login(username, password) {
    const result = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    csrfToken = result.csrfToken;
    return result;
  },
  async me() {
    const result = await request('/api/auth/me');
    csrfToken = result.csrfToken;
    return result;
  },
  async logout() {
    try {
      await request('/api/auth/logout', { method: 'POST', body: '{}' });
    } finally {
      csrfToken = '';
    }
  },
  async cameras() {
    return request('/api/cameras');
  },
  async addons() {
    return request('/api/addons');
  },
  async updateAddons(addons) {
    return request('/api/addons', { method: 'PUT', body: JSON.stringify({ addons }) });
  },
  async createAddon(addon) {
    return request('/api/addons', { method: 'POST', body: JSON.stringify(addon) });
  },
  async deleteAddon(id) {
    return request(`/api/addons/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  async createCamera(camera) {
    return request('/api/cameras', { method: 'POST', body: JSON.stringify(camera) });
  },
  async updateCamera(id, camera) {
    return request(`/api/cameras/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(camera) });
  },
  async deleteCamera(id) {
    return request(`/api/cameras/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  async toggleCamera(id, active) {
    return request(`/api/cameras/${encodeURIComponent(id)}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    });
  },
  async uploadCameraImage(id, file) {
    const body = new FormData();
    body.set('image', file);
    return request(`/api/cameras/${encodeURIComponent(id)}/image`, { method: 'POST', body });
  },
  async transactions(params = {}) {
    return request(`/api/transactions${buildQueryString(params)}`);
  },
  async createTransaction(transaction, guaranteePhoto) {
    if (guaranteePhoto) {
      const body = new FormData();
      body.set('payload', JSON.stringify(transaction));
      body.set('guaranteePhoto', guaranteePhoto);
      return request('/api/transactions', { method: 'POST', body });
    }
    return request('/api/transactions', { method: 'POST', body: JSON.stringify(transaction) });
  },
  async verifyTransaction(id) {
    return request(`/api/transactions/${encodeURIComponent(id)}/verify`, {
      method: 'PATCH',
      body: '{}',
    });
  },
  async markPrinted(id) {
    return request(`/api/transactions/${encodeURIComponent(id)}/print`, { method: 'POST', body: '{}' });
  },
  async voidTransaction(id, reason) {
    return request(`/api/transactions/${encodeURIComponent(id)}/void`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
  },
  async reportSummary(params = {}) {
    return request(`/api/reports/summary${buildQueryString(params)}`);
  },
  async reportPdf(params = {}) {
    return request(`/api/reports/summary/pdf${buildQueryString(params)}`);
  },
};

export function assetUrl(url) {
  if (!url || /^(?:data:|https?:\/\/)/i.test(url)) return url;
  return `${apiRoot}${url.startsWith('/') ? '' : '/'}${url}`;
}

export { imageCredentials };
