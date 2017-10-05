import { createSelector } from 'reselect';
import { is, forEach } from 'immutable';

import { rts, truncate } from 'helpers/utils';


const getActiveRemoteBrowserId = state => state.getIn(['remoteBrowsers', 'activeBrowser']) || null;
const getArchives = state => state.getIn(['controls', 'archives']);
const getBookmarks = state => state.getIn(['collection', 'bookmarks']);
const getCollections = state => state.getIn(['collections', 'collections']);
const getRecordings = state => state.getIn(['collection', 'recordings']);
const getRemoteBrowsers = state => state.getIn(['remoteBrowsers', 'browsers']);
const getSize = state => state.getIn(['infoStats', 'size']);
const getStats = state => state.getIn(['infoStats', 'stats']);
const getTimestamp = state => state.getIn(['controls', 'timestamp']);
const getUrl = state => state.getIn(['controls', 'url']);
const getUserCollections = state => state.getIn(['user', 'collections']);
const selectedCollection = state => state.getIn(['user', 'activeCollection']);
const userOrderBy = state => state.get('userOrderBy') || 'timestamp';

const sortFn = (a, b, by = null) => {
  if (by) {
    if (a.get(by) > b.get(by)) return -1;
    if (a.get(by) < b.get(by)) return 1;
  } else {
    if (a > b) return -1;
    if (a < b) return 1;
  }
  return 0;
};


export const getActiveCollection = createSelector(
  [getUserCollections, selectedCollection],
  (collections, activeCollection) => {
    if(!activeCollection)
      return { title: null, id: null };

    const selected = collections.find(coll => coll.get('id') === activeCollection);
    const title = selected.get('title');
    const id = selected.get('id');
    return { title: truncate(title, 40), id };
  }
);


//let lastBookmarks = null;
export const getOrderedBookmarks = createSelector(
  getBookmarks, userOrderBy,
  (bookmarks, order) => {
    //console.log('running', 'getOrderedBookmarks', bookmarks === lastBookmarks, is(bookmarks, lastBookmarks));
    //lastBookmarks = bookmarks;
    return bookmarks.flatten(true).sortBy(o => o.get(order));
  }
);


/**
 * Match the current `url` and `timestamp` with a recording in the collection
 */
export const getRecording = createSelector(
  [getRecordings, getTimestamp, getUrl],
  (recordings, ts, url) => {
    const matchFn = ts ? obj => rts(obj.get('url')) === rts(url) && obj.get('timestamp') === ts :
                         obj => rts(obj.get('url')) === rts(url);

    for (const rec of recordings) {
      const match = rec.get('pages').find(matchFn);

      if (match) {
        return rec;
      }
    }

    return null;
  }
);


export const getActiveRecording = createSelector(
  [getOrderedBookmarks, getTimestamp, getUrl],
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


export const getActiveRemoteBrowser = createSelector(
  [getActiveRemoteBrowserId, getRemoteBrowsers],
  (activeBrowserId, browsers) => {
    return activeBrowserId ? browsers.get(activeBrowserId) : null;
  }
);


export const getBookmarkCount = createSelector(
  [getBookmarks],
  (bookmarks) => {
    return bookmarks.flatten(true).size;
  }
);


export const getRemoteArchiveStats = createSelector(
  [getStats, getSize, getArchives],
  (stats, size, archives) => {
    const resources = [];

    if (stats.size > 0) {
      const sortedStats = stats.sort(sortFn);
      sortedStats.forEach((stat, id) => {
        // fixed resources
        if (['live', 'replay'].includes(id)) {
          switch (id) {
            case 'live':
              return resources.push({ name: 'Live web', id, stat });
            case 'replay':
              return resources.push({ name: 'Live web at time of recording', id, stat });
            default:
              break;
          }
        }

        const srcCollection = id.split(':', 2);
        let name = archives.getIn([srcCollection[0], 'name']);

        if (srcCollection.length > 1) {
          name += ` ${srcCollection[1]}`;
        }

        return resources.push({
          name,
          id,
          stat
        });
      });

      return resources;
    }

    return null;
  }
);


export const sortCollsByCreatedAt = createSelector(
  [getCollections],
  (collections) => {
    return collections.sort((a, b) => sortFn(a, b, 'created_at'));
  }
);


export const sumCollectionsSize = createSelector(
  [getCollections],
  (collections) => {
    return collections.reduce((sum, coll) => parseInt(coll.get('size'), 10) + sum, 0);
  }
);
