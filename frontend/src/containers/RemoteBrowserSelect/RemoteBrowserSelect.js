import React, { Component } from 'react';
import { connect } from 'react-redux';
import { fromJS } from 'immutable';

import { load, selectBrowser } from 'redux/modules/remoteBrowsers';

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

const mapStateToProps = (state) => {
  const remoteBrowsers = state.get('remoteBrowsers');
  return {
    accessed: remoteBrowsers.get('accessed'),
    activeBrowser: remoteBrowsers.get('activeBrowser'),
    browsers: remoteBrowsers.get('browsers'),
    loaded: remoteBrowsers.get('loaded'),
    loading: remoteBrowsers.get('loading'),
    selectedBrowser: remoteBrowsers.get('selectedBrowser'),
    timestamp: state.getIn(['controls', 'timestamp']),
    url: state.getIn(['controls', 'url'])
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
