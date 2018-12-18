import config from 'config';
import { Set } from 'immutable';


export function addTrailingSlash(url) {
  if (url.match(/^https?\:\/\/[\w-.]+$/)) {
    url += '/';
  }
  return url;
}


export function apiFetch(path, data, opts = {}) {
  const options = Object.assign({
    credentials: 'same-origin',
    body: JSON.stringify(data),
    headers: new Headers({
      'Content-Type': 'application/json',
      'x-requested-with': 'XMLHttpRequest'
    })
  }, opts);

  return fetch(`${config.apiPath}${path}`, options);
}


export function buildDate(dt, gmt, humanize) {
  let displayTime;
  if(humanize) {
    const ms = new Date().getTime() - new Date(dt);
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    const months = Math.floor(days / 31);
    if (months <= 1) {
      if (days < 1) {
        return 'less than a day ago';
      } else if (days === 1) {
        return '1 day ago';
      } else if (days > 1) {
        return `${days} days ago`;
      }
    } else if(months >= 12) {
      return 'over a year ago';
    } else {
      return `${months} months ago`;
    }
  }

  if (dt) {
    let DTString = String(dt);

    if (DTString.length < 14) {
      DTString += '10000101000000'.substr(DTString.length);
    }

    const datestr = (DTString.substring(0, 4) + '-' +
                     DTString.substring(4, 6) + '-' +
                     DTString.substring(6, 8) + 'T' +
                     DTString.substring(8, 10) + ':' +
                     DTString.substring(10, 12) + ':' +
                     DTString.substring(12, 14) + '-00:00');

    const date = new Date(datestr);
    if (gmt) {
      displayTime = date.toGMTString();
    } else {
      displayTime = date.toLocaleString();
    }
  }

  return displayTime;
}


export function capitalize(str) {
  if (!str) {
    return str;
  }

  return str.length ? str[0].toUpperCase() + str.slice(1) : '';
}


export function deleteStorage(key, device = null) {
  try {
    const storageDevice = device || window.localStorage;
    return storageDevice.removeItem(`${config.storageKey}${key}`);
  } catch (e) {
    console.log(`Failed deleting ${key} in ${device}`);
  }
  return null;
}


/**
 * Event dispatcher with ie support
 */
export function dispatchEvent(eventStr) {
  if (!window) {
    return;
  }

  let evt;
  if (typeof Event === 'function') {
    evt = new Event(eventStr);
  } else {
    evt = document.createEvent('Event');
    evt.initEvent(eventStr, true, true);
  }

  window.dispatchEvent(evt);
}


/**
 * Helpful with the need to set the height of an element before a css transition.
 * Prevents browsers from mereging updates into the same frame.
 */
export function doubleRAF(cb) {
  if (typeof window === 'undefined') {
    return cb();
  }

  requestAnimationFrame(
    () => requestAnimationFrame(cb)
  );
}


export function fixMalformedUrls(url) {
  if (!url.match(/^https?:\/\//)) {
    const malformed = url.match(/^([https]+)?[:/]{1,3}/i);
    url = `http://${url.substr(malformed ? malformed[0].length : 0)}`;
  }
  return url;
}


export function getCollectionLink(coll, manage = false) {
  return `/${coll.get('owner')}/${coll.get('slug')}${manage ? '/manage' : ''}`;
}


export function getListLink(coll, list, manage = false) {
  return `${getCollectionLink(coll)}/list/${list.get('slug')}${manage ? '/manage' : ''}`;
}


export function getStorage(key, device = null) {
  try {
    const storageDevice = device || window.localStorage;
    return storageDevice.getItem(`${config.storageKey}${key}`);
  } catch (e) {
    console.log(`Failed getting ${key} in ${device}`);
  }
  return null;
}


export function inStorage(key, device = null) {
  try {
    const storageDevice = device || window.localStorage;
    return Object.prototype.hasOwnProperty.call(storageDevice, `${config.storageKey}${key}`);
  } catch (e) {
    console.log(`Failed checking ${device} for key ${key}`);
    return false;
  }
}


export function isMS() {
  if (/(MSIE|Edge|rv:11)/i.test(navigator.userAgent)) {
    return true;
  }

  return false;
}


export function isoToDisplay(dateTime, gmt = false) {
  let displayTime;
  const date = new Date(dateTime);
  if (gmt) {
    displayTime = date.toGMTString();
  } else {
    displayTime = date.toLocaleString();
  }
  return displayTime;
}


/**
 * quick naive array comparison
 */
export function isEqual(a, b) {
  let match = true;

  if ((!a || !b) || a.length !== b.length) {
    return false;
  }

  // mismatched types
  if (Object.prototype.toString.call(a) !== Object.prototype.toString.call(b)) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    match = a[i] === b[i];
  }

  return match;
}


export function isSafari() {
  return navigator.userAgent.indexOf('Safari') > -1 && navigator.userAgent.indexOf('Chrome') === -1;
}


export function keyIn(...keys) {
  const keySet = Set(keys);
  return function (v, k) {
    return keySet.has(k);
  }
}


export function passwordPassRegex(password) {
  if (!password) {
    return false;
  }

  const rgx = password.match(config.passwordRegex);
  return rgx && rgx[0] === password;
}


export function promiseDelay(t) {
  return new Promise(resolve => setTimeout(resolve, t));
}


export function range(start, end) {
  return Array((end - start) + 1).fill().map((_, idx) => start + idx);
}


export function remoteBrowserMod(rb, ts, sep) {
  // no remote browsers on player
  if (__PLAYER__) {
    return ts || '';
  }

  let base = ts || '';
  if (rb) {
    base += `$br:${rb}`;
  }
  if (base && sep) {
    base += sep;
  }
  return base;
}


/**
 * Remove trailing slash
 * @param  {string} val url to modify
 * @return {string}     url without trailing slash
 */
export function rts(val) {
  if (!val) return val;
  return val.replace(/\/$/, '');
}


export function setStorage(key, value, device = null) {
  try {
    const storageDevice = device || window.localStorage;
    storageDevice.setItem(`${config.storageKey}${key}`, value);
  } catch (e) {
    console.log(`Failed setting ${key}=${value} in ${device}`);
  }
}


export function setTitle(msg, url, title) {
  if (!title) {
    title = url;
  }

  document.title = `${title} (${msg})`;
}


export function stopPropagation(evt) {
  evt.stopPropagation();
}


/**
 * Remove http/https from the beginning of a url
 * @param  {string} val url to modify
 * @return {string}     url without protocol
 */
export function stripProtocol(url) {
  return url.replace(/^https?:\/\//i, '');
}


export function throttle(fn, wait) {
  let t = Date.now();
  return () => {
    if ((t + wait) - Date.now() < 0) {
      fn();
      t = Date.now();
    }
  };
}


/**
 * Truncate supplied text by regex
 * @param  {string} str    input string
 * @param  {int}    count   number of segments to clip by
 * @param  {RegExp} delimiter   paren wrapped regular expression e.g. `new RegExp(/([.?!])/)`
 * @return {string}
 */
export function truncate(str, count, delimiter = null) {
  if (!str) {
    return str;
  }

  const by = delimiter || new RegExp(/(.)/);
  const seg = str.split(by);
  return seg.length > count * 2 ? `${seg.splice(0, count * 2).join('').trim()}...` : str;
}
