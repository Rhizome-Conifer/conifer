import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { asyncConnect } from 'redux-connect';
import { BreadcrumbsItem } from 'react-breadcrumbs-dynamic';

import { truncate } from 'helpers/utils';
import { load as loadColl } from 'redux/modules/collection';
import { isLoaded as isRBLoaded, load as loadRB } from 'redux/modules/remoteBrowsers';
import { getOrderedBookmarks, getOrderedRecordings } from 'redux/selectors';

import CollectionDetailUI from 'components/CollectionDetailUI';


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
    const { collection, params: { user, coll } } = this.props;

    return [
      <BreadcrumbsItem key="a" to={`/${user}`}>{ user }</BreadcrumbsItem>,
      <BreadcrumbsItem key="b" to={`/${user}/${coll}`}>{ truncate(collection.get('title'), 60) }</BreadcrumbsItem>,
      <CollectionDetailUI key="c" {...this.props} />
    ];
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
    recordings: getOrderedRecordings(state),
    bookmarks: getOrderedBookmarks(state)
  };
};

export default asyncConnect(
  initialData,
  mapStateToProps
)(CollectionDetail);
