import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';
import { asyncConnect } from 'redux-connect';

import { getActiveRecording, getOrderedBookmarks } from 'redux/selectors';
import { isLoaded, load as loadColl } from 'redux/modules/collection';

import { IFrame, ReplayUI } from 'components/Controls';


class Replay extends Component {
  static contextTypes = {
    product: PropTypes.string
  }

  static propTypes = {
    collection: PropTypes.object,
    bookmarks: PropTypes.object,
    recordingIndex: PropTypes.number,
    params: PropTypes.object
  }

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
    const { collection, bookmarks, recordingIndex, params } = this.props;
    const { product } = this.context;

    const shareUrl = `http://localhost:8089/${params.user}/${params.coll}/${params.ts}/${params.splat}`;
    const iframeUrl = `http://localhost:8089/${params.user}/${params.coll}/${params.ts}mp_/${params.splat}`;

    return (
      <div>
        <Helmet>
          <meta property="og:url" content={shareUrl} />
          <meta property="og:type" content="website" />
          <meta property="og:title" content={`Archived page from the &ldquo;${collection.get('title')}&rdquo; Collection on ${product}`} />
          <meta name="og:description" content={collection.get('desc') ? collection.getIn(['collection', 'desc']) : 'Create high-fidelity, interactive web archives of any web site you browse.'} />
        </Helmet>

        <ReplayUI
          bookmarks={bookmarks}
          recordingIndex={recordingIndex}
          params={params} />

        <IFrame
          url={iframeUrl}
          params={params} />
      </div>
    );
  }
}

const loadCollection = [
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
  }
];

const mapStateToProps = (state, props) => {
  return {
    bookmarks: getOrderedBookmarks(state),
    recordingIndex: getActiveRecording(state, props),
    collection: state.get('collection'),
    auth: state.get('auth')
  };
};

export default asyncConnect(
  loadCollection,
  mapStateToProps
)(Replay);
