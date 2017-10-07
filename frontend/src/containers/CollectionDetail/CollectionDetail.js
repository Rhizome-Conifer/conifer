import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { asyncConnect } from 'redux-connect';
import { Link } from 'react-router';
import { BreadcrumbsItem } from 'react-breadcrumbs-dynamic';

import { isLoaded as isCollLoaded,
         load as loadColl } from 'redux/modules/collection';
import { isLoaded as isRBLoaded, load as loadRB } from 'redux/modules/remoteBrowsers';
import { truncate } from 'helpers/utils';

import BookmarksTable from 'components/BookmarksTable';
import CollectionMetadata from 'components/CollectionMetadata';
import RecordingColumn from 'components/RecordingColumn';

import './style.scss';

class CollectionDetail extends Component {
  static propTypes = {
    collection: PropTypes.object,
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
    const { auth, params: { user } } = this.props;
    const username = auth.getIn(['user', 'username']);

    return {
      canAdmin: username === user,
      canWrite: username === user //&& !auth.anon
    };
  }

  render() {
    const { auth, collection, params: { user, coll }, remoteBrowsers } = this.props;

    const username = auth.getIn(['user', 'username']);
    const canAdmin = username === user;
    const canWrite = username === user; // && !auth.anon

    return (
      <div>
        <BreadcrumbsItem to={`/${user}`}>{ user }</BreadcrumbsItem>
        <BreadcrumbsItem to={`/${user}/${coll}`}>{ truncate(collection.get('title'), 60) }</BreadcrumbsItem>

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
                  <Link to={`/${user}/${coll}/$new`} className="btn btn-primary btn-sm">
                    <span className="glyphicon glyphicon-plus glyphicon-button" aria-hidden="true" />New
                  </Link>
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
            collection={collection}
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
      const collId = collection.get('id');
      const { user, coll } = params;

      //if(!isCollLoaded(state) || collId !== coll || (collId === coll && Date.now() - collection.get('accessed') > 15 * 60 * 1000))
      return dispatch(loadColl(user, coll));

      //return undefined;
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
    remoteBrowsers: state.get('remoteBrowsers')
  };
};

export default asyncConnect(
  loadCollection,
  mapStateToProps
)(CollectionDetail);
