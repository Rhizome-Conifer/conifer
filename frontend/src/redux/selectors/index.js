import { createSelector } from 'reselect';
import { List } from 'immutable';
import { getSearchSelectors } from 'redux-search';
import { columnMappings } from 'config';

import { rts, truncate } from 'helpers/utils';


const getActiveRemoteBrowserId = state => state.getIn(['remoteBrowsers', 'activeBrowser']) || null;
const getActiveBookmarkId = state => (state.app ? state.app : state).getIn(['controls', 'activeBookmarkId']);
const getArchives = state => state.getIn(['controls', 'archives']);
const getCollections = state => state.getIn(['collections', 'collections']);
const getColumn = state => (state.app ? state.app : state).getIn(['pageQuery', 'column']);
const getQuery = state => (state.app ? state.app : state).getIn(['pageQuery', 'query']);
const getListBookmarks = state => (state.app ? state.app : state).getIn(['list', 'bookmarks']);
const getPages = state => (state.app ? state.app : state).getIn(['collection', 'pages']);
const getRecordings = state => state.getIn(['collection', 'recordings']);
const getRemoteBrowsers = state => state.getIn(['remoteBrowsers', 'browsers']);
const getSize = state => state.getIn(['infoStats', 'size']);
const getStats = state => state.getIn(['infoStats', 'stats']);
const getTimestamp = state => (state.app ? state.app : state).getIn(['controls', 'timestamp']);
const getUrl = state => (state.app ? state.app : state).getIn(['controls', 'url']);
const getUserCollections = state => state.getIn(['user', 'collections']);
const selectedCollection = state => state.getIn(['user', 'activeCollection']);
const userSortBy = state => (state.app ? state.app : state).getIn(['collection', 'sortBy']);


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


// redux-search
const { text, result } = getSearchSelectors({
  resourceName: 'collection.pages',
  resourceSelector: (resourceName, state) => {
    return state.app.getIn(resourceName.split('.'));
  }
});


export const getSearchText = createSelector(
  [text],
  searchText => searchText
);


export const tsOrderedPageSearchResults = createSelector(
  [result, getPages, text],
  (pageIds, pageObjs, searchText) => {
    const pages = List(pageIds.map(id => pageObjs.get(id)));
    const pageFeed = pages.sortBy(o => o.get('timestamp')).reverse();

    return {
      pageFeed,
      searchText
    };
  }
);


export const pageSearchResults = createSelector(
  [result, getPages, userSortBy, text],
  (pageIds, pageObjs, sortBy, searchText) => {
    const pages = List(pageIds.map(id => pageObjs.get(id)));
    const sort = sortBy.get('sort');
    const dir = sortBy.get('dir');
    const pageFeed = pages.sortBy(o => o.get(sort));

    if (dir === 'DESC') {
      return {
        pageFeed: pageFeed.reverse(),
        searchText
      };
    }
    return {
      pageFeed,
      searchText
    };
  }
);


export const getActiveCollection = createSelector(
  [getUserCollections, selectedCollection],
  (collections, activeCollection) => {
    if(!activeCollection)
      return { title: null, id: null };

    const selected = collections.find(coll => coll.get('id') === activeCollection);
    if (!selected)
      return { title: null, id: null };

    const title = selected.get('title');
    const id = selected.get('id');
    return { title: truncate(title, 40), id };
  }
);


export const getOrderedRecordings = createSelector(
  [getRecordings],
  (recordings) => {
    const sortedRecordings = recordings.sortBy(o => o.get('created_at'));

    return sortedRecordings;
  }
);


export const timestampOrderedPages = createSelector(
  [getPages],
  (pages) => {
    return pages.toList().sortBy(b => b.get('timestamp')).reverse();
  }
);


export const getOrderedPages = createSelector(
  getPages, userSortBy,
  (pages, sortBy) => {
    const sort = sortBy.get('sort');
    const dir = sortBy.get('dir');
    const sortedPages = pages.toList().sortBy(o => o.get(sort));

    if (dir === 'DESC') {
      return sortedPages.reverse();
    }
    return sortedPages;
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


export const getActiveRecording = createSelector(
  [getOrderedPages, getTimestamp, getUrl],
  (pages, ts, url) => {
    return sortedSearch(pages, ts, url);
  }
);


export const getActivePage = createSelector(
  [tsOrderedPageSearchResults, getTimestamp, getUrl],
  (pageSearch, ts, url) => {
    const pages = pageSearch.pageFeed;
    return sortedSearch(pages, ts, url);
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
    return orderedPages.filter(o => o.get(c) === query);
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
