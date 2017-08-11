import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { asyncConnect } from 'redux-connect';

import { load as loadColl } from 'redux/modules/collection';
import { isLoaded, load as loadRB } from 'redux/modules/remoteBrowsers';

import BookmarksTable from 'components/BookmarksTable';
import CollectionMetadata from 'components/CollectionMetadata';
import RecordingColumn from 'components/RecordingColumn';

import './style.scss';

class CollectionDetail extends Component {
  static propTypes = {
    coll: PropTypes.object,
    auth: PropTypes.object,
    params: PropTypes.object,
    remoteBrowsers: PropTypes.object
  };

  // TODO move to HOC
  static childContextTypes = {
    canAdmin: PropTypes.bool,
    canWrite: PropTypes.bool
  };

  getChildContext() {
    const { auth, params } = this.props;
    const username = auth.getIn(['user', 'username']);

    return {
      canAdmin: username === params.user,
      canWrite: username === params.user //&& !auth.anon
    };
  }

  render() {
    const { auth, coll, params, remoteBrowsers } = this.props;

    const username = auth.getIn(['user', 'username']);
    const canAdmin = username === params.user;
    const canWrite = username === params.user; // && !auth.anon
    const collection = coll.get('collection');

    return (
      <div>
        <CollectionMetadata
          title={collection.get('title')}
          desc={collection.get('desc')}
          dlUrl={collection.get('download_url')} />

        <div className="row wr-collection-info">
          <div className="hidden-xs recording-panel">
            <h5>RECORDINGS</h5>
            {
              canWrite &&
                <div>
                  <a href="$new" className="btn btn-primary btn-sm">
                    <span className="glyphicon glyphicon-plus glyphicon-button" aria-hidden="true" />New
                  </a>
                  {
                    canAdmin &&
                      <a className="btn btn-default btn-sm upload-coll-button">
                        <span className="glyphicon glyphicon-upload glyphicon-button" />&nbsp;
                        <span className="upload-label">Upload</span>
                      </a>
                  }
                </div>
            }

            <RecordingColumn recordings={collection.get('recordings')} />
          </div>

          <BookmarksTable
            collection={coll}
            browsers={remoteBrowsers.get('browsers')} />
        </div>
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

      if(!isLoaded(state) || collection.get('coll') !== coll || (collection.get('coll') === coll && Date.now() - collection.get('accessed') > 15 * 60 * 1000))
        return dispatch(loadColl(user, coll));

      return undefined;
    }
  },
  {
    promise: ({ store: { dispatch, getState } }) => {
      if(!isLoaded(getState()))
        return dispatch(loadRB());

      return undefined;
    }
  }
];

const mapStateToProps = (state) => {
  return {
    auth: state.get('auth'),
    coll: state.get('collection'),
    remoteBrowsers: state.get('remoteBrowsers')
  };
};

export default asyncConnect(
  loadCollection,
  mapStateToProps
)(CollectionDetail);
