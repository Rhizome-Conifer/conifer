import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { Button, DropdownButton, Dropdown } from 'react-bootstrap';

import { product, supporterPortal } from 'config';

import { BugReport } from 'containers';

import Modal from 'components/Modal';
import SizeFormat from 'components/SizeFormat';
import { GearIcon, UserIcon } from 'components/icons';

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

  componentDidUpdate(prevProps) {
    if (prevProps.auth.get('loggingIn') && !this.props.auth.get('loggingIn')) {
      if (!this.props.auth.get('loginError')) {
        //this.closeLogin();
        if (this.state.formError) {
          this.setState({ formError: false });
        }

        const next = prevProps.next !== null ? prevProps.next : `/${this.props.auth.getIn(['user', 'username'])}`;
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
              <li className="d-none d-sm-block">
                <Link to="/_faq">About</Link>
              </li>
          }

          {
            !__DESKTOP__ &&
              <li className="navbar-text d-none d-lg-block">
                <button onClick={this.toggleBugModal} className="borderless custom-report" type="button">Report Bug</button>
              </li>
          }

          <li className="d-none d-lg-block">
            {
              __DESKTOP__ ?
                <button className="button-link" onClick={this.openDesktopHelp} type="button">Help</button> :
                <a href="https://guide.conifer.rhizome.org/" target="_blank">Help</a>
            }
          </li>

          {
            supporterPortal &&
              <li className="d-none d-xl-block">
                <a href={supporterPortal} target="_blank">{user.get('customer_id') ? 'Manage Support' : 'Support Us'}</a>
              </li>
          }

          { !auth.get('loaded') || !username || (isAnon && collCount === 0) ?
            <React.Fragment>
              <li><Link to="/_register">Sign Up</Link></li>
              <li><Button variant="primary" onClick={this.showLogin}>Login</Button></li>
            </React.Fragment> :
            <li className="navbar-text">
              <DropdownButton id="user-dropdown" title={userDropdown} onToggle={this.toggleDropdown}>
                {
                  !__DESKTOP__ &&
                    <li className="display login-display">
                      <span className="sm-label">{ isAnon ? 'Active as' : 'Signed in as'}</span>
                      <h5>{user.get('full_name') || username}</h5>
                      <span className="username"><UserIcon />&nbsp;{ username }</span>
                    </li>
                }

                {
                  hasCollections &&
                    <Dropdown.Item onClick={this.goToCollections}>
                      Your Collections<span className="num-collection">{ collCount }</span>
                    </Dropdown.Item>
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
                    <Dropdown.Divider />
                }

                {
                  !isAnon &&
                    <Dropdown.Item onClick={this.goToSettings}><GearIcon /> { __DESKTOP__ ? 'App' : 'Account' } Settings</Dropdown.Item>
                }

                {
                  !__DESKTOP__ &&
                    <React.Fragment>
                      <Dropdown.Divider />
                      <Dropdown.Item href="https://guide.conifer.rhizome.org/" target="_blank">User Guide</Dropdown.Item>
                      <Dropdown.Item href="mailto:support@conifer.rhizome.org" target="_blank">Contact Support</Dropdown.Item>
                      <Dropdown.Divider />
                      <Dropdown.Item onClick={this.goToFAQ}>About {product}</Dropdown.Item>
                      <Dropdown.Item href="https://blog.conifer.rhizome.org" target="_blank">{product} Blog</Dropdown.Item>
                    </React.Fragment>
                }

                {
                  (!isAnon && !__DESKTOP__) &&
                    <React.Fragment>
                      <Dropdown.Divider />
                      <Dropdown.Item onClick={this.goToLogout}>Logout</Dropdown.Item>
                    </React.Fragment>
                }
                {
                  isAnon &&
                    <React.Fragment>
                      <Dropdown.Divider />
                      <Dropdown.Item onClick={this.goToSignup}>Sign Up</Dropdown.Item>
                      <Dropdown.Item onClick={this.showLogin}>Login</Dropdown.Item>

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
