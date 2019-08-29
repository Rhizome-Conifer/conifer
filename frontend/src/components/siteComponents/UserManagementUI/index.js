import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { DropdownButton, MenuItem } from 'react-bootstrap';

import { product, supporterPortal } from 'config';

import { BugReport } from 'containers';

import Modal from 'components/Modal';
import SizeFormat from 'components/SizeFormat';
import { UserIcon } from 'components/icons';

import LoginForm from './loginForm';
import './style.scss';

let shell;
if (__DESKTOP__) {
  shell = window.require('electron').shell; // eslint-disable-line
}


class UserManagementUI extends PureComponent {
  static propTypes = {
    anonCTA: PropTypes.bool,
    auth: PropTypes.object,
    canAdmin: PropTypes.bool,
    history: PropTypes.object,
    loadAuth: PropTypes.func,
    loginFn: PropTypes.func.isRequired,
    next: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    open: PropTypes.bool,
    reportModal: PropTypes.bool,
    route: PropTypes.object,
    showModal: PropTypes.func,
    toggleBugModal: PropTypes.func
  };

  constructor(options) {
    super(options);

    this.state = {
      formError: null
    };
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.auth.get('loggingIn') && !nextProps.auth.get('loggingIn')) {
      if (!nextProps.auth.get('loginError')) {
        //this.closeLogin();
        if (this.state.formError) {
          this.setState({ formError: false });
        }

        const next = this.props.next !== null ? this.props.next : `/${nextProps.auth.getIn(['user', 'username'])}`;
        if (next.startsWith('http')) {
          window.location.href = next;
        } else {
          this.props.history.push(next);
        }
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

  openDesktopHelp = (evt) => {
    evt.preventDefault();
    shell.openExternal('https://github.com/webrecorder/webrecorder-desktop#webrecorder-desktop-app');
  }

  save = (data) => {
    this.setState({ formError: false });
    this.props.loginFn(data);
  }

  toggleBugModal = () => {
    const { route, reportModal } = this.props;
    const mode = /record|replay|extract|patch/.test(route.name) ? 'dnlr' : 'ui';
    this.props.toggleBugModal(reportModal !== null ? null : mode);
  }

  toggleDropdown = (isOpen) => {
    if (isOpen) {
      this.props.loadAuth();
    }
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
    const hasCollections = (!isAnon || (isAnon && collCount > 0));

    return (
      <React.Fragment>
        <ul className="navbar-user-links">
          {
            isAnon &&
              <li>
                <Link to="/_faq">About</Link>
              </li>
          }

          {
            !__DESKTOP__ &&
              <li className="navbar-text hidden-xs">
                <button onClick={this.toggleBugModal} className="borderless custom-report" type="button">Report Bug</button>
              </li>
          }

          <li className="hidden-xs">
            {
              __DESKTOP__ ?
                <button className="button-link" onClick={this.openDesktopHelp} type="button">Help</button> :
                <a href="https://guide.webrecorder.io/" target="_blank">Help</a>
            }
          </li>

          {
            supporterPortal &&
              <li className="hidden-xs">
                <a href={supporterPortal} target="_blank">{user.get('customer_id') ? 'Manage Support' : 'Support Us'}</a>
              </li>
          }

          { !auth.get('loaded') || !username || (isAnon && collCount === 0) ?
            <React.Fragment>
              <li><Link to="/_register">Sign Up</Link></li>
              <li><button className="rounded login-link" onClick={this.showLogin} type="button">Login</button></li>
            </React.Fragment> :
            <li className="navbar-text">
              <DropdownButton pullRight id="user-dropdown" title={userDropdown} onToggle={this.toggleDropdown}>
                {
                  !__DESKTOP__ &&
                    <li className="display login-display">
                      <span className="sm-label">{ isAnon ? 'Active as' : 'Signed in as'}</span>
                      <h5>{user.get('full_name') || username}</h5>
                      <span className="username"><span className="glyphicon glyphicon-user right-buffer-sm" />{ username }</span>
                    </li>
                }

                {
                  hasCollections &&
                    <MenuItem onClick={this.goToCollections}>
                      Your Collections<span className="num-collection">{ collCount }</span>
                    </MenuItem>
                }
                {
                  hasCollections &&
                    <li className="display">
                      <span className="sm-label space-usage">Space Used: {usage}% of {<SizeFormat bytes={user.getIn(['space_utilization', 'total'])} />}</span>
                      <div className="space-display">
                        <span style={{ width: `${usage}%` }} />
                      </div>
                    </li>
                }

                {
                  __DESKTOP__ &&
                    <MenuItem divider />
                }

                {
                  !isAnon &&
                    <MenuItem onClick={this.goToSettings}><span className="glyphicon glyphicon-wrench" /> { __DESKTOP__ ? 'App' : 'Account' } Settings</MenuItem>
                }

                {
                  !__DESKTOP__ &&
                    <React.Fragment>
                      <MenuItem divider />
                      <MenuItem href="https://guide.webrecorder.io/" target="_blank">User Guide</MenuItem>
                      <MenuItem href="mailto:support@webrecorder.io" target="_blank">Contact Support</MenuItem>
                      <MenuItem divider />
                      <MenuItem onClick={this.goToFAQ}>About Webrecorder</MenuItem>
                      <MenuItem href="https://blog.webrecorder.io" target="_blank">Webrecorder Blog</MenuItem>
                    </React.Fragment>
                }

                {
                  (!isAnon && !__DESKTOP__) &&
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

        <BugReport route={this.props.route} />

      </React.Fragment>
    );
  }
}

export default UserManagementUI;
