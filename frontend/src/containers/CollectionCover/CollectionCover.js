import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { asyncConnect } from 'redux-connect';
import { Map } from 'immutable';

import { timestampOrderedPages } from 'store/selectors';

import { isLoaded as isCollLoaded, load as loadColl, loadLists } from 'store/modules/collection';
import { isLoaded as isRBLoaded, load as loadRB } from 'store/modules/remoteBrowsers';
import { getQueryPages, getOrderedPages } from 'store/selectors';
import { pageSearchResults } from 'store/selectors/search';

import CollectionCoverUI from 'components/collection/CollectionCoverUI';

class CollectionCover extends Component {
  static childContextTypes = {
    asPublic: PropTypes.bool,
    canAdmin: PropTypes.bool
  };

  static propTypes = {
    auth: PropTypes.object,
    location: PropTypes.object,
    match: PropTypes.object
  };

  getChildContext() {
    const { auth, location: { search }, match: { params: { user } } } = this.props;
    const username = auth.getIn(['user', 'username']);

    const asPublic = search ? search.indexOf('asPublic') !== -1 : false;

    return {
      canAdmin: username === user && !asPublic,
      asPublic
    };
  }

  render() {
    return (
      <CollectionCoverUI {...this.props} />
    );
  }
}

const initialData = [
  {
    promise: ({ match: { params: { coll, user } }, store: { dispatch, getState } }) => {
      const state = getState();
      let host = '';

      if (__PLAYER__) {
        host = state.app.getIn(['appSettings', 'host']);
      }

      return dispatch(loadColl(user, coll, host))
        .then(() => dispatch(loadLists(user, coll, 'all', host)));
    }
  },
  {
    promise: ({ store: { dispatch, getState } }) => {
      const state = getState();

      if (!isRBLoaded(state) && !__DESKTOP__) {
        return dispatch(loadRB());
      }

      return undefined;
    }
  }
];


const mapStateToProps = (outerState) => {
  const { app } = outerState;
  const isLoaded = app.getIn(['collection', 'loaded']);
  const { pageFeed, searchText } = isLoaded ? pageSearchResults(outerState) : { pageFeed: Map(), searchText: '' };
  const isIndexing = isLoaded && !pageFeed.size && app.getIn(['collection', 'pages']).size && !searchText;

  const querying = app.getIn(['pageQuery', 'querying']);
  let pages;

  if (querying) {
    pages = getQueryPages(app);
  } else {
    pages = isIndexing ? getOrderedPages(app) : pageFeed;
  }

  return {
    auth: app.get('auth'),
    browsers: app.get('remoteBrowsers'),
    collection: app.get('collection'),
    orderdPages: timestampOrderedPages(app),
    pages
  };
};


export default asyncConnect(
  initialData,
  mapStateToProps
)(CollectionCover);
