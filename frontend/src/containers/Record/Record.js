import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { asyncConnect } from 'redux-connect';

import config from 'config';

import { isLoaded, load as loadColl } from 'redux/modules/collection';

import { IFrame, ReplayUI } from 'components/Controls';


class Record extends Component {
  static contextTypes = {
    product: PropTypes.string
  }

  static propTypes = {
    auth: PropTypes.object,
    collection: PropTypes.object,
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
      currMode: 'record',
      canAdmin: auth.getIn(['user', 'username']) === params.user
    };
  }

  render() {
    const { params } = this.props;
    const { user, coll, rec, splat } = params;

    const iframeUrl = `${config.contentHost}/${user}/${coll}/${rec}/record/mp_/${splat}`;

    return (
      <div>
        <ReplayUI params={params} />

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

const mapStateToProps = (state) => {
  return {
    collection: state.get('collection'),
    auth: state.get('auth')
  };
};

export default asyncConnect(
  loadCollection,
  mapStateToProps
)(Record);
