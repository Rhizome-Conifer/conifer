import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Map } from 'immutable';

import { saveDelay } from 'config';

import { load } from 'store/modules/remoteBrowsers';
import { editBookmark, load as loadList, resetBookmarkEdit } from 'store/modules/list';

import { InlineBrowserSelectUI } from 'components/controls';


class InlineBrowserSelect extends Component {
  static defaultProps = {
    browsers: Map(),
  };

  render() {
    return (!__DESKTOP__ &&
      <InlineBrowserSelectUI {...this.props} />
    );
  }
}

const mapStateToProps = ({ app }) => {
  const remoteBrowsers = app.get('remoteBrowsers');
  return {
    browsers: remoteBrowsers.get('browsers'),
    collection: app.get('collection'),
    list: app.get('list'),
    loaded: remoteBrowsers.get('loaded'),
    loading: remoteBrowsers.get('loading')
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    getBrowsers: () => dispatch(load()),
    editBk: (user, coll, list, bkId, data) => {
      return (
        dispatch(editBookmark(user, coll, list, bkId, data))
          .then(() => dispatch(loadList(user, coll, list)))
          .then(() => setTimeout(() => dispatch(resetBookmarkEdit()), saveDelay))
      );
    }
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(InlineBrowserSelect);
