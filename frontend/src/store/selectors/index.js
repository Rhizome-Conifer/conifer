import { createSelector } from 'reselect';
import { List } from 'immutable';

import { columnMappings } from 'config';

import { rts, truncate } from 'helpers/utils';

import {
  getArchives,
  getActiveBookmarkId,
  getActiveRemoteBrowserId,
  getCollections,
  getColumn,
  getListBookmarks,
  getPages,
  getQuery,
  getRecordings,
  getRemoteBrowsers,
  getSize,
  getStats,
  getTimestamp,
  getUrl,
  getUserCollections,
  selectedCollection,
  userSortBy,
  userSortDir,
} from './access';


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
    if (!activeCollection) {
      return { title: null, id: null };
    }

    const selected = collections.find(coll => coll.get('id') === activeCollection);
    if (!selected) {
      return { title: null, id: null };
    }

    const title = selected.get('title');
    const id = selected.get('id');
    return { title: truncate(title, 40), id };
  }
);


export const getOrderedRecordings = createSelector(
  [getRecordings],
  (recordings) => {
    if (!recordings) {
      return List();
    }

    const sortedRecordings = recordings.sortBy(o => o.get('created_at')).reverse();
    return sortedRecordings;
  }
);


export const timestampOrderedPages = createSelector(
  [getPages],
  (pages) => {
    return pages ? pages.toList().sortBy(b => b.get('timestamp')).reverse() : List();
  }
);


export const timestampOrderedIds = createSelector(
  [timestampOrderedPages],
  (orderdPages) => {
    return orderdPages.map(v => v.get('id'));
  }
);


export const getOrderedPages = createSelector(
  getPages, userSortBy, userSortDir,
  (pages, sort, dir) => {
    if (!pages) {
      return List();
    }

    const sortedPages = pages.toList().sortBy(o => o.get(sort));

    if (dir === 'DESC') {
      return sortedPages.reverse();
    }
    return sortedPages;
  }
);


const sortedSearch = (sortedPages, timestamp, url) => {
  if (!timestamp) {
    const idx = sortedPages.findIndex((b) => { return b.get('url') === url || rts(b.get('url')) === rts(url); });
    return idx === -1 ? 0 : idx;
  }

  const ts = parseInt(timestamp, 10);
  let minIdx = 0;
  let maxIdx = sortedPages.size - 1;
  let curIdx;
  let curUrl;
  let curEle;

  while (minIdx <= maxIdx) {
    curIdx = ((minIdx + maxIdx) / 2) | 0;
    curUrl = sortedPages.get(curIdx).get('url');
    curEle = parseInt(sortedPages.get(curIdx).get('timestamp'), 10);

    if (curEle > ts) {
      minIdx = curIdx + 1;
    } else if (curEle < ts) {
      maxIdx = curIdx - 1;
    } else if (curEle === ts && (url !== curUrl && rts(url) !== rts(curUrl))) {
      /**
       * If multiple recordings are within a timestamp, or if the url
       * for the timestamp doesn't match exactly, iterate over other
       * options. If no exact match is found, resolve to first ts match.
       */
      let tempUrl;
      const origIdx = curIdx;
      while (curEle === ts && curIdx < sortedPages.size - 1) {
        tempUrl = sortedPages.get(++curIdx).get('url');
        curEle = parseInt(sortedPages.get(curIdx).get('ts'), 10);
        if (tempUrl === url) {
          return curIdx;
        }
      }
      return origIdx;
    } else {
      return curIdx;
    }
  }
  return -1;
};


export const getActivePageIdx = createSelector(
  [timestampOrderedPages, getTimestamp, getUrl],
  (pages, ts, url) => {
    return sortedSearch(pages, ts, url);
  }
);


export const getActivePage = createSelector(
  [timestampOrderedPages, getActivePageIdx],
  (pages, pgIdx) => {
    return pages.get(pgIdx);
  }
);


export const getActiveBookmark = createSelector(
  [getListBookmarks, getActiveBookmarkId],
  (bookmarks, bkId) => {
    return bookmarks.find(bk => bk.get('id') === bkId);
  }
);


export const getActiveBookmarkByValues = createSelector(
  [getListBookmarks, getTimestamp, getUrl],
  (bookmarks, ts, url) => {
    const rtsUrl = rts(url);

    return bookmarks.findIndex(o => o.get('timestamp') === ts &&
                                    rts(o.get('url')) === rtsUrl);
  }
);


export const getActiveRemoteBrowser = createSelector(
  [getActiveRemoteBrowserId, getRemoteBrowsers],
  (activeBrowserId, browsers) => {
    return activeBrowserId ? browsers.get(activeBrowserId) : null;
  }
);


export const getPageCount = createSelector(
  [getPages],
  (pages) => {
    return (pages ? pages.size : 0);
  }
);


export const getQueryPages = createSelector(
  [getOrderedPages, getColumn, getQuery],
  (orderedPages, column, query) => {
    const c = columnMappings.hasOwnProperty(column) ? columnMappings[column] : column;
    const exact = query.startsWith('"') && query.endsWith('"') && query.length > 1;
    const _query = exact ? query.substring(1, query.length - 1) : query;

    return orderedPages.filter((o) => {
      return o.get(c) &&
      (exact ? o.get(c) === _query : o.get(c).startsWith(_query));
    });
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


export const sortUserCollsByUpdateAt = createSelector(
  [getUserCollections],
  colls => colls.sortBy(c => c.get('updated_at')).reverse()
);

export const sortUserCollsByAlpha = createSelector(
  [getUserCollections],
  colls => colls.sortBy(c => c.get('title').toLowerCase())
);


export const splitPagesBySession = createSelector(
  [getRecordings, getPages],
  (recordings, pages) => {
    const recs = {};

    if (!recordings) {
      return recs;
    }

    /* eslint-disable */
    for(const rec of recordings) {
      const r = rec.get('id');
      recs[r] = pages.filter(p => p.get('rec') === r).toList();
    }
    /* eslint-enable */
    return recs;
  }
);


export const sortCollsByCreatedAt = createSelector(
  [getCollections],
  (collections) => {
    return collections.sort((a, b) => sortFn(a, b, 'created_at'));
  }
);


export const sortCollsByAlpha = createSelector(
  [getCollections],
  colls => colls.sortBy(c => c.get('title').toLowerCase())
);


export const sumCollectionsSize = createSelector(
  [getCollections],
  (collections) => {
    return collections.reduce((sum, coll) => parseInt(coll.get('size'), 10) + sum, 0);
  }
);
