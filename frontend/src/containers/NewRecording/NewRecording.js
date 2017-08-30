import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { asyncConnect } from 'redux-connect';

import { isLoaded, load as loadColl } from 'redux/modules/collection';
import { getActiveRemoteBrowser } from 'redux/selectors';

import { NewRecordingUI } from 'components/controls';


class NewRecording extends Component {
  static contextTypes = {
    product: PropTypes.string
  }

  static propTypes = {
    auth: PropTypes.object,
    collection: PropTypes.string,
    extractable: PropTypes.object,
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
      currMode: 'new',
      canAdmin: auth.getIn(['user', 'username']) === params.user
    };
  }

  render() {
    const { collection, extractable } = this.props;

    return (
      <div>
        <NewRecordingUI
          collection={collection}
          extractable={extractable} />
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

const mapStateToProps = (state) => {
  return {
    auth: state.get('auth'),
    collection: state.get('collection'),
    extractable: state.getIn(['controls', 'extractable']),
    remoteBrowserSelected: getActiveRemoteBrowser(state)
  };
};

export default asyncConnect(
  loadCollection,
  mapStateToProps
)(NewRecording);
