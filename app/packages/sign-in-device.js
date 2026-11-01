// Store a coarse label rather than the raw user agent or an IP address.
export function describeSignInDevice(userAgent = '') {
  const agent = String(userAgent).slice(0, 1000);
  const browser = /Edg(?:e|A|iOS)?\//.test(agent) ? 'Edge'
    : /(?:Firefox|FxiOS)\//.test(agent) ? 'Firefox'
    : /(?:Chrome|CriOS)\//.test(agent) ? 'Chrome'
    : /Version\/.+Safari\//.test(agent) ? 'Safari' : '';
  const os = /Android/.test(agent) ? 'Android' : /iPhone|iPad/.test(agent) ? 'iOS'
    : /Windows/.test(agent) ? 'Windows' : /Macintosh|Mac OS/.test(agent) ? 'macOS'
    : /Linux/.test(agent) ? 'Linux' : '';
  return [browser, os].filter(Boolean).join(' · ');
}
