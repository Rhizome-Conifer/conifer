import React, { Component } from 'react';
import { connect } from 'react-redux';
import sumBy from 'lodash/sumBy';

import { Panel, ProgressBar } from 'react-bootstrap';
import SizeFormat from 'components/SizeFormat';


class UserSettings extends Component {

  render() {
    const { user } = this.props;
    const userInfo = <h2>Usage for <b>{ user.data.username }</b></h2>;

    return (
      <Panel header={userInfo}>
        <span>Space Used: </span>
        <SizeFormat bytes={sumBy(user.data.collections, 'size')} />
        <ProgressBar now={20} bsStyle="success" />
        Please contact us if you would like to request additional space.
      </Panel>
    );
  }
}

const mapStateToProps = (state) => {
  const { user } = state;
  return {
    user
  };
};

const mapDispatchToProps = (dispatch) => {
  return {

  };
};

export default connect(
  mapStateToProps
)(UserSettings);
