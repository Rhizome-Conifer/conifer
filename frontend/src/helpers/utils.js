
/**
 * Remove trailing slash
 * @param  {string} val url to modify
 * @return {string}     url without trailing slash
 */
export function rts(val) {
  return val.replace(/\/$/, '');
}

export function stripProtocol(val) {
  return val.replace(/https?:\/\//i, '');
}
