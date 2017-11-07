import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { asyncConnect } from 'redux-connect';
import { BreadcrumbsItem } from 'react-breadcrumbs-dynamic';

import { isLoaded, load as loadColl } from 'redux/modules/collection';
import { truncate } from 'helpers/utils';

import { NewRecordingUI } from 'components/controls';


class NewRecording extends Component {
  static contextTypes = {
    product: PropTypes.string
  };

  static propTypes = {
    auth: PropTypes.object,
    collection: PropTypes.object,
    extractable: PropTypes.object,
    params: PropTypes.object
  };

  // TODO move to HOC
  static childContextTypes = {
    currMode: PropTypes.string,
    canAdmin: PropTypes.bool,
    product: PropTypes.string
  };

  getChildContext() {
    const { auth, params } = this.props;

    return {
      currMode: 'new',
      canAdmin: auth.getIn(['user', 'username']) === params.user
    };
  }

  render() {
    const { collection, extractable, params: { user, coll } } = this.props;

    return [
      <BreadcrumbsItem to={`/${user}`}>{ user }</BreadcrumbsItem>,
      <BreadcrumbsItem to={`/${user}/${coll}`}>{ truncate(collection.get('title'), 60) }</BreadcrumbsItem>,
      <BreadcrumbsItem to={`/${user}/${coll}`}>{ truncate(collection.get('title'), 60) }</BreadcrumbsItem>,
      <BreadcrumbsItem to={`/${user}/${coll}/$new`}>Create a new recording</BreadcrumbsItem>,

      <NewRecordingUI
        collection={collection}
        extractable={extractable} />
    ];
  }
}

const loadCollection = [
  {
    promise: ({ params, store: { dispatch, getState } }) => {
      const state = getState();
      const collection = state.app.get('collection');
      const { user, coll } = params;

      if(!isLoaded(state) || (collection.get('id') === coll &&
         Date.now() - collection.get('accessed') > 15 * 60 * 1000)) {
        return dispatch(loadColl(user, coll));
      }

      return undefined;
    }
  }
];

const mapStateToProps = ({ app }) => {
  return {
    auth: app.get('auth'),
    collection: app.get('collection'),
    extractable: app.getIn(['controls', 'extractable']),
    remoteBrowserSelected: app.getIn(['remoteBrowsers', 'activeBrowser'])
  };
};

export default asyncConnect(
  loadCollection,
  mapStateToProps
)(NewRecording);
