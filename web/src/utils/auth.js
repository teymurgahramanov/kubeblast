export function getAccessToken() {
  return localStorage.getItem('access_token') || '';
}

function base64UrlDecode(input) {
  try {
    let str = String(input || '');
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    const pad = str.length % 4;
    if (pad) {
      str += '='.repeat(4 - pad);
    }
    const decoded = atob(str);
    try {
      return decodeURIComponent(
        decoded.split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
      );
    } catch {
      return decoded;
    }
  } catch {
    return '';
  }
}

export function decodeJwt(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;
    const payload = base64UrlDecode(parts[1]);
    if (!payload) return null;
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export function getUserRole() {
  const token = getAccessToken();
  const decoded = decodeJwt(token);
  const claimRole = decoded && (decoded.role || decoded['https://kubeblast/role']);
  if (typeof claimRole === 'string' && claimRole.trim()) {
    return claimRole.trim();
  }
  const stored = localStorage.getItem('user_role');
  return stored && stored.trim() ? stored.trim() : '';
}

export function getUsername() {
  const token = getAccessToken();
  const decoded = decodeJwt(token);
  const sub = decoded && (decoded.sub || decoded.preferred_username || decoded.email);
  if (typeof sub === 'string' && sub.trim()) {
    return sub.trim();
  }
  const stored = localStorage.getItem('username');
  return stored && stored.trim() ? stored.trim() : '';
}


