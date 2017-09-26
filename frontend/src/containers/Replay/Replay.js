import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';
import { asyncConnect } from 'redux-connect';
import { BreadcrumbsItem } from 'react-breadcrumbs-dynamic';

import { truncate } from 'helpers/utils';
import config from 'config';

import { getActiveRecording, getOrderedBookmarks } from 'redux/selectors';
import { isLoaded, load as loadColl } from 'redux/modules/collection';
import { getArchives } from 'redux/modules/controls';
import { createRemoteBrowser } from 'redux/modules/remoteBrowsers';

import { RemoteBrowser } from 'containers';
import { IFrame, ReplayUI } from 'components/controls';


class Replay extends Component {
  static contextTypes = {
    product: PropTypes.string
  };

  static propTypes = {
    activeBrowser: PropTypes.object,
    auth: PropTypes.object,
    collection: PropTypes.object,
    dispatch: PropTypes.func,
    bookmarks: PropTypes.object,
    recordingIndex: PropTypes.number,
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
      currMode: 'replay',
      canAdmin: auth.getIn(['user', 'username']) === params.user
    };
  }

  render() {
    const { activeBrowser, bookmarks, collection, dispatch, params, recordingIndex } = this.props;
    const { product } = this.context;

    const shareUrl = `${config.host}${params.user}/${params.coll}/${params.ts}/${params.splat}`;
    const prefix = `${config.contentHost}/${params.user}/${params.coll}/`;

    return (
      <div>
        <Helmet>
          <meta property="og:url" content={shareUrl} />
          <meta property="og:type" content="website" />
          <meta property="og:title" content={`Archived page from the &ldquo;${collection.get('title')}&rdquo; Collection on ${product}`} />
          <meta name="og:description" content={collection.get('desc') ? collection.getIn(['collection', 'desc']) : 'Create high-fidelity, interactive web archives of any web site you browse.'} />
        </Helmet>

        <BreadcrumbsItem to={`/${params.user}`}>{ params.user }</BreadcrumbsItem>
        <BreadcrumbsItem to={`/${params.user}/${params.coll}`}>{ truncate(collection.get('title'))}</BreadcrumbsItem>

        <ReplayUI
          bookmarks={bookmarks}
          recordingIndex={recordingIndex}
          params={params} />

        {
          activeBrowser ?
            <RemoteBrowser /> :
            <IFrame
              params={params}
              prefix={prefix}
              dispatch={dispatch} />
        }
      </div>
    );
  }
}

const initialData = [
  {
    promise: ({ params, store: { dispatch, getState } }) => {
      const state = getState();
      const collection = state.get('collection');
      const { user, coll } = params;

      if(!isLoaded(state) || (collection.get('id') === coll &&
         Date.now() - collection.get('accessed') > 15 * 60 * 1000)) {
        return dispatch(loadColl(user, coll));
      }

      return undefined;
    }
  },
  /*
  {
    promise: ({ store: { dispatch, getState } }) => {
      const state = getState();
      const rb = state.getIn(['remoteBrowsers', 'activeBrowser']);

      // if remote browser is active, load up a new instance
      if (rb) {
        return dispatch(createRemoteBrowser(rb));
      }

      return undefined;
    }
  },*/
  {
    promise: ({ store: { dispatch, getState } }) => {
      const state = getState();

      // TODO: determine if we need to test for stale archives
      if (!state.getIn(['controls', 'archives']).size) {
        return dispatch(getArchives());
      }

      return undefined;
    }
  }
];

const mapStateToProps = (state, props) => {
  return {
    activeBrowser: state.getIn(['remoteBrowsers', 'activeBrowser']),
    auth: state.get('auth'),
    bookmarks: getOrderedBookmarks(state),
    collection: state.get('collection'),
    recordingIndex: getActiveRecording(state, props)
  };
};

export default asyncConnect(
  initialData,
  mapStateToProps
)(Replay);
