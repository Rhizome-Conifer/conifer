import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { asyncConnect } from 'redux-connect';

import { load as loadColl } from 'redux/modules/collection';
import { isLoaded as isRBLoaded, load as loadRB } from 'redux/modules/remoteBrowsers';
import { getOrderedRecordings } from 'redux/selectors';

import { CollectionDetailUI } from 'components/siteComponents';


class CollectionDetail extends Component {

    // TODO move to HOC
  static childContextTypes = {
    canAdmin: PropTypes.bool,
    canWrite: PropTypes.bool
  };

  getChildContext() {
    const { auth, params: { user } } = this.props;
    const username = auth.getIn(['user', 'username']);

    return {
      canAdmin: username === user,
      canWrite: username === user //&& !auth.anon
    };
  }

  render() {
    return (
      <CollectionDetailUI {...this.props} />
    );
  }
}


const initialData = [
  {
    promise: ({ params, store: { dispatch } }) => {
      const { user, coll } = params;

      return dispatch(loadColl(user, coll));
    }
  },
  {
    promise: ({ store: { dispatch, getState } }) => {
      if(!isRBLoaded(getState()))
        return dispatch(loadRB());

      return undefined;
    }
  }
];

const mapStateToProps = (state) => {
  return {
    auth: state.get('auth'),
    collection: state.get('collection'),
    browsers: state.get('remoteBrowsers'),
    recordings: getOrderedRecordings(state)
  };
};

export default asyncConnect(
  initialData,
  mapStateToProps
)(CollectionDetail);
