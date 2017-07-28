import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';
import { asyncConnect } from 'redux-connect';

import { load as loadColl } from 'redux/modules/collection';

import ReplayIFrame from 'components/ReplayIFrame';
import ReplayUI from 'components/ReplayUI';

class Replay extends Component {
  static propTypes = {
    recordings: PropTypes.array,
    auth: PropTypes.object,
    params: PropTypes.object
  };

  // TODO move to HOC
  static childContextTypes = {
    currMode: PropTypes.string,
    canAdmin: PropTypes.bool
  };

  getChildContext() {
    const { auth, collection, params, } = this.props;

    return {
      currMode: 'replay',
      canAdmin: auth.user.username === params.user
    };
  }

  render() {
    const { collection, params } = this.props;
    const iframeUrl = `http://localhost:8089/${params.user}/${params.coll}/${params.ts}mp_/${params.splat}`;

    return (
      <div>
        <Helmet>
          <meta property="og:url" content="{/* get_share_url() */}" />
          <meta property="og:type" content="website" />
          <meta property="og:title" content="Archived page from the &ldquo;{{ coll_title|urldecode|e }}&rdquo; Collection on {{ metadata.product }}" />
          <meta name="og:description" content="Create high-fidelity, interactive web archives of any web site you browse.}" />
        </Helmet>

        <ReplayUI
          recordings={collection.bookmarks}
          ts={params.ts}
          url={params.splat} />

        <ReplayIFrame
          url={iframeUrl}
          params={params} />
      </div>
    );
  }
}

const loadRecordings = [
  {
    promise: ({ params, store: { dispatch, getState }, location }) => {
      const { user, coll } = params;
      return dispatch(loadColl(user, coll));
    }
  }
];

const mapStateToProps = (state) => {
  const { auth, collection } = state;
  return {
    collection,
    auth
  };
};

export default asyncConnect(
  loadRecordings,
  mapStateToProps
)(Replay);
