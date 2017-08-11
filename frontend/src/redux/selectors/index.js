import { createSelector } from 'reselect';
import { List } from 'immutable';

import { rts } from 'helpers/utils';


const getTimestamp = (state, props) => props.params.ts;
const getUrl = (state, props) => props.params.splat;
const getRecordings = state => state.getIn(['collection', 'bookmarks']);
const userOrderBy = state => state.get('userOrderBy') || 'timestamp';
const getCollections = (state) => { return state.get('collections') ? state.get('collections') : List(); };

export const sumCollectionsSize = createSelector(
  [getCollections],
  (collections) => {
    return collections.reduce((sum, coll) => parseInt(coll.get('size'), 10) + sum, 0);
  }
);

export const getOrderedRecordings = createSelector(
  [getRecordings, userOrderBy],
  (recordings, order) => {
    return recordings.flatten(true).sortBy(o => o.get(order));
  }
);

export const getActiveRecording = createSelector(
  [getOrderedRecordings, getTimestamp, getUrl],
  (bookmarks, ts, url) => {
    if (!ts) {
      const idx = bookmarks.findIndex((b) => { return b.get('url') === url || rts(b.get('url')) === rts(url); });
      return idx === -1 ? 0 : idx;
    }

    const item = { url, ts: parseInt(ts, 10) };
    let minIdx = 0;
    let maxIdx = bookmarks.size - 1;
    let curIdx;
    let curUrl;
    let curEle;

    while (minIdx <= maxIdx) {
      curIdx = ((minIdx + maxIdx) / 2) | 0;
      curUrl = bookmarks.get(curIdx).get('url');
      curEle = parseInt(bookmarks.get(curIdx).get('timestamp'), 10);

      if (curEle < item.ts) {
        minIdx = curIdx + 1;
      } else if (curEle > item.ts) {
        maxIdx = curIdx - 1;
      } else if (curEle === item.ts && (item.url !== curUrl && rts(item.url) !== rts(curUrl))) {
        /**
         * If multiple recordings are within a timestamp, or if the url
         * for the timestamp doesn't match exactly, iterate over other
         * options. If no exact match is found, resolve to first ts match.
         */
        let tempUrl;
        const origIdx = curIdx;
        while (curEle === item.ts && curIdx < bookmarks.size - 1) {
          tempUrl = bookmarks.get(++curIdx).get('url');
          curEle = parseInt(bookmarks.get(curIdx).get('ts'), 10);
          if (tempUrl === item.url) {
            return curIdx;
          }
        }
        return origIdx;
      } else {
        return curIdx;
      }
    }

    return 0;
  }
);
