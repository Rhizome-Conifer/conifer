import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { load, selectBrowser } from 'redux/modules/remoteBrowsers';

import RemoteBrowserSelectUI from 'components/RemoteBrowserSelectUI';


class RemoteBrowserSelect extends Component {
  static propTypes = {
    browsers: PropTypes.object,
  }

  static defaultProps = {
    browsers: {},
    activeBrowser: null
  }

  render() {
    return (
      <RemoteBrowserSelectUI {...this.props} />
    );
  }
}

const mapStateToProps = (state) => {
  const { accessed, activeBrowser, browsers,
          loaded, loading } = state.remoteBrowsers;
  return {
    accessed,
    activeBrowser,
    browsers,
    loaded,
    loading
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    getBrowsers: () => dispatch(load()),
    setBrowser: br => dispatch(selectBrowser(br))
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(RemoteBrowserSelect);
