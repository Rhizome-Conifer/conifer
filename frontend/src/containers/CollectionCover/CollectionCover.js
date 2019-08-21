import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { asyncConnect } from 'redux-connect';
import { Map } from 'immutable';

import { timestampOrderedPages } from 'store/selectors';

import { load as loadColl, loadLists } from 'store/modules/collection';
import { isLoaded as isRBLoaded, load as loadRB } from 'store/modules/remoteBrowsers';
import { getOrderedPages } from 'store/selectors';
import { AccessContext } from 'store/contexts';

import CollectionCoverUI from 'components/collection/CollectionCoverUI';

class CollectionCover extends Component {
  static propTypes = {
    auth: PropTypes.object,
    match: PropTypes.object
  };

  render() {
    const { auth, match: { params: { user } } } = this.props;
    const contextValues = { canAdmin: auth.getIn(['user', 'username']) === user };

    return (
      <AccessContext.Provider value={contextValues}>
        <CollectionCoverUI {...this.props} />
      </AccessContext.Provider>
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
  const pages = getOrderedPages(app);

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
