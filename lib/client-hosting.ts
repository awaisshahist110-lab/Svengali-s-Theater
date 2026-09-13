declare global {
  var __SVENGALI_HOSTING__: { apiOrigin: string; assetBase: string } | undefined;
}

export function gameApi(query = '') {
  return (globalThis.__SVENGALI_HOSTING__?.apiOrigin ?? '') + '/api/game' + query;
}

export function assetUrl(path: string) {
  return (globalThis.__SVENGALI_HOSTING__?.assetBase ?? '') + path;
}
