import { createSelector } from 'reselect';
import flatten from 'lodash/flatten';
import orderBy from 'lodash/orderBy';
import findIndex from 'lodash/findIndex';

import { rts } from 'helpers/utils';


const getTimestamp = (state, props) => props.params.ts;
const getUrl = (state, props) => props.params.splat;
const getRecordings = state => state.collection.bookmarks;
const userOrderBy = state => state.userOrderBy || 'timestamp';

export const getOrderedRecordings = createSelector(
  [getRecordings, userOrderBy],
  (recordings, order) => {
    return orderBy(flatten(recordings), order);
  }
);

export const getActiveRecording = createSelector(
  [getOrderedRecordings, getTimestamp, getUrl],
  (bookmarks, ts, url) => {
    if (!ts) {
      const idx = findIndex(bookmarks, (b) => { return b.url === url || rts(b.url) === rts(url); });
      return idx === -1 ? 0 : idx;
    }

    const item = { url, ts: parseInt(ts, 10) };
    let minIdx = 0;
    let maxIdx = bookmarks.length - 1;
    let curIdx;
    let curEle;

    while (minIdx <= maxIdx) {
      curIdx = ((minIdx + maxIdx) / 2) | 0;
      curEle = parseInt(bookmarks[curIdx].timestamp, 10);

      if (curEle < item.ts) {
        minIdx = curIdx + 1;
      } else if (curEle > item.ts) {
        maxIdx = curIdx - 1;
      } else if (curEle === item.ts && (item.url !== bookmarks[curIdx].url && rts(item.url) !== rts(bookmarks[curIdx].url))) {
        /**
         * If multiple recordings are within a timestamp, or if the url
         * for the timestamp doesn't match exactly, iterate over other
         * options. If no exact match is found, resolve to first ts match.
         */
        let tempUrl;
        const origIdx = curIdx;
        while (curEle === item.ts && curIdx < bookmarks.length - 1) {
          tempUrl = bookmarks[++curIdx].url;
          curEle = parseInt(bookmarks[curIdx].ts, 10);
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
