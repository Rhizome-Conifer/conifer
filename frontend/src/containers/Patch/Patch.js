import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { asyncConnect } from 'redux-connect';

import config from 'config';

import { isLoaded, load as loadColl } from 'redux/modules/collection';
import { getArchives } from 'redux/modules/controls';

import { IFrame, ReplayUI } from 'components/controls';


class Patch extends Component {
  static contextTypes = {
    product: PropTypes.string
  }

  static propTypes = {
    auth: PropTypes.object,
    collection: PropTypes.object,
    dispatch: PropTypes.func,
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
      currMode: 'patch',
      canAdmin: auth.getIn(['user', 'username']) === params.user
    };
  }

  render() {
    const { dispatch, params } = this.props;
    const { user, coll, rec } = params;

    const prefix = `${config.contentHost}/${user}/${coll}/${rec}/patch/`;
    //const iframeUrl = `${config.contentHost}/${user}/${coll}/${rec}/patch/mp_/${splat}`;

    return (
      <div>
        <ReplayUI params={params} />

        <IFrame
          dispatch={dispatch}
          params={params}
          prefix={prefix} />
      </div>
    );
  }
}

const initialData = [
  {
    promise: ({ params, store: { dispatch, getState } }) => {
      // load collection
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

const mapStateToProps = (state) => {
  return {
    collection: state.get('collection'),
    auth: state.get('auth')
  };
};

export default asyncConnect(
  initialData,
  mapStateToProps
)(Patch);
