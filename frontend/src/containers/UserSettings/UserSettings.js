import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { asyncConnect } from 'redux-connect';
import { Panel, ProgressBar } from 'react-bootstrap';

import { isLoaded as isAuthLoaded } from 'redux/modules/auth';
import { load as loadUser, isLoaded as isUserLoaded } from 'redux/modules/user';
import SizeFormat from 'components/SizeFormat';

import './style.scss';

class UserSettings extends Component {
  static propTypes = {
    collSum: PropTypes.number,
    user: PropTypes.object
  }

  render() {
    const { user } = this.props;

    const usedSpace = user.getIn(['space_utilization', 'used']);
    const totalSpace = user.getIn(['space_utilization', 'total']);

    const userInfo = <h2>Usage for <b>{ user.get('username') }</b></h2>;
    const passReset = (
      <div className="pw-reset">
        <h3 className="panel-title">Change Password</h3>
        <span>Enter your current password, and your new password below.</span>
      </div>
    );
    const deleteAccount = <h3 className="panel-title">Delete Account</h3>;

    return (
      <div className="row top-buffer col-xs-10 col-xs-push-1">
        <Panel header={userInfo}>
          <span>Space Used: </span>
          <SizeFormat bytes={usedSpace} />
          <ProgressBar now={(usedSpace / totalSpace) * 100} bsStyle="success" />
          Please <a href="mailto:support@webrecorder.io">contact us</a> if you would like to request additional space.
        </Panel>

        <Panel header={passReset} className="top-buffer">
          <div className="row col-md-3">
            {/*action="/_updatepassword"*/}
            <form id="changepassword" method="post" role="form">
              <div className="form-group">
                <label htmlFor="curr_password">Current Password</label>
                <input type="password" id="curr_password" name="curr_password" className="form-control input-sm" value="" placeholder="" required="true" />
                <div className="help-block with-errors" />
              </div>

              <div className="form-group">
                <label htmlFor="password">New Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  className="form-control input-sm"
                  required />
                <div className="help-block with-errors" />
              </div>

              <div className="form-group">
                <label htmlFor="password">Confirm New Password</label>
                <input
                  type="password"
                  id="confirmpassword"
                  name="confirmpassword"
                  className="form-control input-sm"
                  required />
                <div className="help-block with-errors" />
              </div>

              <button className="btn btn-primary btn-sm" type="submit">Change Password</button>
            </form>
          </div>
        </Panel>

        <Panel
          className="buffer-top"
          bsStyle="danger"
          header={deleteAccount}>
          <div className="row col-md-6">
            <div>
              <b>Permanently delete this account and all archived data for this user</b>
              <p>This action can not be undone!</p>
              <button className="btn btn-sm btn-danger" data-toggle="modal" data-target="#confirm-delete-modal">Delete Account</button>
            </div>
          </div>
        </Panel>
      </div>
    );
  }
}

const preloadData = [
  {
    promise: ({ store: { dispatch, getState } }) => {
      const state = getState();

      if(isAuthLoaded(state) && !isUserLoaded(state))
        return dispatch(loadUser(state.getIn(['auth', 'user', 'username'])));

      return undefined;
    }
  }
];

const mapStateToProps = (state) => {
  return {
    user: state.get('user')
  };
};

const mapDispatchToProps = (dispatch) => {
  return {

  };
};

export default asyncConnect(
  preloadData,
  mapStateToProps
)(UserSettings);
