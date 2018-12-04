import { createSelector } from 'reselect';
import { getSearchSelectors } from 'redux-search';
import { List } from 'immutable';

import {
  getPages,
  userSortBy,
  userSortDir
} from './access';


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
  [result, getPages, userSortBy, userSortDir, text],
  (pageIds, pageObjs, sort, dir, searchText) => {
    const pages = List(pageIds.map(id => pageObjs.get(id)));
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
