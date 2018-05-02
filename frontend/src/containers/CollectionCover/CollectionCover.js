import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { asyncConnect } from 'redux-connect';

import { timestampOrderedPages } from 'redux/selectors';

import { isLoaded as isCollLoaded, load as loadColl } from 'redux/modules/collection';

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

      // if switching to list view, prevent reloading collection
      if ((!isCollLoaded(state) || state.app.getIn(['collection', 'id']) !== coll)) {
        return dispatch(loadColl(user, coll));
      }

      return undefined;
    }
  },
];


const mapStateToProps = ({ app }) => {
  return {
    auth: app.get('auth'),
    collection: app.get('collection'),
    orderdPages: timestampOrderedPages(app)
  };
};


export default asyncConnect(
  initialData,
  mapStateToProps
)(CollectionCover);
