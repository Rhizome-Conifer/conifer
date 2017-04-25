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
    browsers: {}
  }

  render() {
    return (
      <RemoteBrowserSelectUI {...this.props} />
    );
  }
}

const mapStateToProps = (state) => {
  return {
    ...state.remoteBrowsers
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
