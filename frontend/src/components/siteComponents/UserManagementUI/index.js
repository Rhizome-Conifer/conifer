import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { Button, ControlLabel, DropdownButton, FormControl, FormGroup, MenuItem } from 'react-bootstrap';

import { product } from 'config';

import Modal from 'components/Modal';
import SizeFormat from 'components/SizeFormat';
import { UserIcon } from 'components/icons';

import LoginForm from './loginForm';
import './style.scss';


class UserManagementUI extends PureComponent {
  static propTypes = {
    anonCTA: PropTypes.bool,
    auth: PropTypes.object,
    canAdmin: PropTypes.bool,
    history: PropTypes.object,
    loginFn: PropTypes.func.isRequired,
    next: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    open: PropTypes.bool,
    sendUIReport: PropTypes.func,
    showModal: PropTypes.func,
    toggleBugModal: PropTypes.func,
    uiBug: PropTypes.bool
  };

  constructor(options) {
    super(options);

    this.state = {
      desc: '',
      formError: null,
      email: ''
    };
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.auth.get('loggingIn') && !nextProps.auth.get('loggingIn')) {
      if (!nextProps.auth.get('loginError')) {
        //this.closeLogin();
        if (this.state.formError) {
          this.setState({ formError: false });
        }

        this.props.history.push(
          this.props.next !== null ? this.props.next : `/${nextProps.auth.getIn(['user', 'username'])}`
        );
      } else {
        this.setState({ formError: true });
      }
    }
  }

  showLogin = () => {
    this.props.showModal(true);
  }

  closeLogin = () => {
    this.props.showModal(false);
    this.setState({ formError: false });
  }

  goToCollections = () => {
    const { auth, history } = this.props;
    history.push(`/${auth.getIn(['user', 'username'])}`);
  }

  goToFAQ = () => {
    this.props.history.push('/_faq');
  }

  goToLogout = () => {
    this.props.history.push('/_logout');
  }

  goToSettings = () => {
    const { auth, history } = this.props;
    history.push(`/${auth.getIn(['user', 'username'])}/_settings`);
  }

  goToSignup = () => {
    this.props.history.push('/_register');
  }

  handleInput = (evt) => {
    this.setState({ [evt.target.name]: evt.target.value });
  }

  save = (data) => {
    this.setState({ formError: false });
    this.props.loginFn(data);
  }

  sendBugReport = () => {
    const { desc, email } = this.state;
    if (desc) {
      this.props.sendUIReport({ desc, email, url: window.location.href });
      this.toggleBugModal();
    }
  }

  toggleBugModal = () => {
    this.props.toggleBugModal(!this.props.uiBug);
  }

  render() {
    const { anonCTA, auth, canAdmin, open } = this.props;
    const { formError } = this.state;

    const form = (
      <LoginForm
        anonCTA={anonCTA}
        auth={auth}
        cb={this.save}
        error={formError}
        closeLogin={this.closeLogin} />
    );
    const collCount = auth.getIn(['user', 'num_collections']);
    const user = auth.get('user');
    const username = user.get('username');
    const isAnon = user.get('anon');

    const userDropdown = <React.Fragment><UserIcon dark={canAdmin} />{ isAnon ? 'Temporary Account' : username }</React.Fragment>;
    const usage = (user.getIn(['space_utilization', 'used']) / user.getIn(['space_utilization', 'total']) * 100) + 0.5 | 0;

    return (
      <React.Fragment>
        <ul className="navbar-user-links">
          {
            isAnon &&
              <li>
                <Link to="/_faq">About</Link>
              </li>
          }

          <li className="navbar-text">
            <button onClick={this.toggleBugModal} className="borderless custom-report" type="button">Report Bug</button>
            <Modal
              dialogClassName="ui-bug-modal"
              header="Submit a UI bug"
              visible={this.props.uiBug}
              closeCb={this.toggleBugModal}
              footer={<React.Fragment><Button onClick={this.toggleBugModal}>Cancel</Button><Button bsStyle="primary" onClick={this.sendBugReport}>Submit</Button></React.Fragment>}>
              <p>Spot something off? Let us know what's happening:</p>
              <FormGroup>
                <FormControl aria-label="description" componentClass="textarea" name="desc" placeholder="When I click the 'save' button when editing my collection description, nothing happens." onChange={this.handleInput} value={this.state.bugReport} />
              </FormGroup>
              <FormGroup>
                <ControlLabel>Email to notify in response to this issue: (optional)</ControlLabel>
                <FormControl aria-label="email" name="email" placeholder="me@example.com" onChange={this.handleInput} value={this.state.email} />
              </FormGroup>
            </Modal>
          </li>

          <li>
            <a href="https://webrecorder.github.io/webrecorder-user-guide/" target="_blank">Help</a>
          </li>

          { !auth.get('loaded') || !username || (isAnon && collCount === 0) ?
            <React.Fragment>
              <li><Link to="/_register">Sign Up</Link></li>
              <li><button className="rounded login-link" onClick={this.showLogin} type="button">Login</button></li>
            </React.Fragment> :
            <li className="navbar-text">
              <DropdownButton pullRight id="user-dropdown" title={userDropdown}>
                <li className="display login-display">
                  <span className="sm-label">{ isAnon ? 'Active as' : 'Signed in as'}</span>
                  <h5>{user.get('name') || username}</h5>
                  <span className="username"><span className="glyphicon glyphicon-user right-buffer-sm" />{ username }</span>
                </li>

                {
                  (!isAnon || (isAnon && collCount > 0)) &&
                    <React.Fragment>
                      <MenuItem onClick={this.goToCollections}>
                        Your Collections<span className="num-collection">{ collCount }</span>
                      </MenuItem>
                      <li className="display">
                        <span className="sm-label">Space Used: {usage}% of {<SizeFormat bytes={user.getIn(['space_utilization', 'total'])} />}</span>
                        <div className="space-display">
                          <span style={{ width: `${usage}%` }} />
                        </div>
                      </li>
                    </React.Fragment>
                }

                {
                  !isAnon &&
                    <MenuItem onClick={this.goToSettings}><span className="glyphicon glyphicon-wrench" /> Account Settings</MenuItem>
                }

                <MenuItem divider />
                <MenuItem href="https://webrecorder.github.io/webrecorder-user-guide/" target="_blank">User Guide</MenuItem>
                <MenuItem href="mailto:support@webrecorder.io" target="_blank">Contact Support</MenuItem>
                <MenuItem divider />
                <MenuItem onClick={this.goToFAQ}>About Webrecorder</MenuItem>
                <MenuItem href="https://blog.webrecorder.io" target="_blank">Webrecorder Blog</MenuItem>
                {
                  !isAnon &&
                    <React.Fragment>
                      <MenuItem divider />
                      <MenuItem onClick={this.goToLogout}><span className="glyphicon glyphicon-log-out" title="Logout" /> Logout</MenuItem>
                    </React.Fragment>
                }
                {
                  isAnon &&
                    <React.Fragment>
                      <MenuItem divider />
                      <MenuItem onClick={this.goToSignup}>Sign Up</MenuItem>
                      <MenuItem onClick={this.showLogin}>Login</MenuItem>

                    </React.Fragment>
                }
              </DropdownButton>
            </li>
          }
        </ul>
        <Modal
          dialogClassName="wr-login-modal"
          header={anonCTA ? null : `${product} Login`}
          body={form}
          visible={open}
          closeCb={this.closeLogin} />
      </React.Fragment>
    );
  }
}

export default UserManagementUI;
