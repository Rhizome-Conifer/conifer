import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { asyncConnect } from 'redux-connect';

import { load as loadColl } from 'redux/modules/collection';
import { isLoaded, load as loadRB } from 'redux/modules/remoteBrowsers';
//import { load as loadRecs } from 'redux/modules/recordings';

import BookmarksTable from 'components/BookmarksTable';
import CollectionMetadata from 'components/CollectionMetadata';
import RecordingColumn from 'components/RecordingColumn';

import './style.scss';

class CollectionDetail extends Component {
  static propTypes = {
    coll: PropTypes.object
  };

  render() {
    const { coll, remoteBrowsers } = this.props;

    return (
      <div>
        <CollectionMetadata
          title={coll.collection.title}
          desc={coll.collection.desc}
          dlUrl={coll.collection.download_url} />

        <div className="row wr-collection-info">
          <div className="hidden-xs recording-panel">
            <h5>RECORDINGS</h5>
            <div>
              <a href="$new" className="btn btn-primary btn-sm">
                <span className="glyphicon glyphicon-plus glyphicon-button" aria-hidden="true" />New
              </a>
              <a className="btn btn-default btn-sm upload-coll-button">
                <span className="glyphicon glyphicon-upload glyphicon-button" />&nbsp;
                <span className="upload-label">Upload</span>
              </a>
            </div>

            <RecordingColumn recordings={coll.collection.recordings} />
          </div>

          <BookmarksTable
            collection={coll}
            browsers={remoteBrowsers.browsers} />
        </div>
      </div>
    );
  }
}

const loadCollection = [
  {
    promise: ({ params, store: { dispatch, getState }, location }) => {
      const { user, coll } = params;

      return dispatch(loadColl(user, coll));
    }
  },
  {
    promise: ({ params, store: { dispatch, getState }, location }) => {
      if(!isLoaded(getState()))
        return dispatch(loadRB());

      return undefined;
    }
  }
  // {
  //   promise: ({ params, store: { dispatch, getState }, location }) => {
  //     const { user, coll } = params;
  //     return dispatch(loadRecs(user, coll));
  //   }
  // }
];

const mapStateToProps = (state) => {
  const { auth, collection, remoteBrowsers } = state;
  return {
    auth,
    coll: collection,
    remoteBrowsers
  };
};

export default asyncConnect(
  loadCollection,
  mapStateToProps
)(CollectionDetail);
