import React, { Component } from 'react';
import { connect } from 'react-redux';
import { fromJS } from 'immutable';

import { load, selectBrowser } from 'store/modules/remoteBrowsers';

import { RemoteBrowserSelectUI } from 'components/controls';


class RemoteBrowserSelect extends Component {
  static defaultProps = fromJS({
    browsers: {},
    activeBrowser: null
  })

  render() {
    return (
      <RemoteBrowserSelectUI {...this.props} />
    );
  }
}

const mapStateToProps = ({ app }) => {
  const remoteBrowsers = app.get('remoteBrowsers');
  return {
    accessed: remoteBrowsers.get('accessed'),
    activeBookmarkId: app.getIn(['controls', 'activeBookmarkId']),
    activeBrowser: remoteBrowsers.get('activeBrowser'),
    activeList: app.getIn(['controls', 'activeList']),
    browsers: remoteBrowsers.get('browsers'),
    loaded: remoteBrowsers.get('loaded'),
    loading: remoteBrowsers.get('loading'),
    selectedBrowser: remoteBrowsers.get('selectedBrowser'),
    timestamp: app.getIn(['controls', 'timestamp']),
    url: app.getIn(['controls', 'url'])
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    getBrowsers: () => dispatch(load()),
    selectRemoteBrowser: br => dispatch(selectBrowser(br))
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(RemoteBrowserSelect);
