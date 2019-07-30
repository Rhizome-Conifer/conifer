import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import memoize from 'memoize-one';
import { matchPath, NavLink } from 'react-router-dom';

import { AdminHeader, UserManagement } from 'containers';

import BreadcrumbsUI from 'components/siteComponents/BreadcrumbsUI';
import { PlayerArrowLeftIcon, PlayerArrowRightIcon, LogoIcon, RefreshIcon } from 'components/icons';

import './style.scss';


class AppHeader extends PureComponent {
  static propTypes = {
    authUser: PropTypes.object,
    canGoBackward: PropTypes.bool,
    canGoForward: PropTypes.bool,
    history: PropTypes.object,
    is404: PropTypes.bool,
    location: PropTypes.object,
    routes: PropTypes.array
  };

  getActiveMatch = memoize((url) => {
    let match;
    const route = this.props.routes.find((r) => {
      match = matchPath(url, r);
      return match;
    });
    return { match, route };
  })

  triggerBack = () => {
    const { canGoBackward, history, location: { pathname } } = this.props;
    const { route } = this.getActiveMatch(pathname);
    const isWebview = route && ['replay', 'record', 'patch', 'extract'].includes(route.name);
    console.log(route.name);

    if (isWebview && canGoBackward) {
      window.dispatchEvent(new Event('wr-go-back'));
    } else if (history.canGo(-1)) {
      history.goBack();
    }
  }

  triggerForward = () => {
    const { canGoForward, history, location: { pathname } } = this.props;
    const { route } = this.getActiveMatch(pathname);
    const isWebview = route && ['replay', 'record', 'patch', 'extract'].includes(route.name);

    if (isWebview && canGoForward) {
      window.dispatchEvent(new Event('wr-go-forward'));
    } else if (history.canGo(1)) {
      history.goForward();
    }
  }

  triggerRefresh = () => {
    window.dispatchEvent(new Event('wr-refresh'));
  }

  render() {
    const { authUser, canGoForward, history, is404, location: { pathname } } = this.props;
    const { match, route } = this.getActiveMatch(pathname);
    const canAdmin = match && match.params.user === authUser.get('username');

    const isWebview = route && ['replay', 'record', 'patch', 'extract'].includes(route.name);
    const canGoBack = history.canGo(-2);

    const backClass = classNames('arrow', {
      inactive: !canGoBack
    });
    const fwdClass = classNames('arrow', {
      inactive: isWebview ? !canGoForward : !history.canGo(1)
    });
    const refreshClass = classNames('arrow', {
      inactive: !isWebview
    });

    return (
      <header className={classNames('app-header', { dark: canAdmin })}>
        <nav className="header-webrecorder" role="navigation">
          <div className="navbar-tools">
            <NavLink to="/" className="wr-logomark"><LogoIcon darkMode={canAdmin} /></NavLink>
            {
              __DESKTOP__ &&
                <div className="browser-nav">
                  <button onClick={this.triggerBack} disabled={!canGoBack} className={backClass} title="Click to go back" aria-label="navigate back" type="button">
                    <PlayerArrowLeftIcon />
                  </button>
                  <button onClick={this.triggerForward} disabled={isWebview ? !canGoForward : !history.canGo(1)} className={fwdClass} title="Click to go forward" aria-label="navigate forward" type="button">
                    <PlayerArrowRightIcon />
                  </button>
                  <button onClick={this.triggerRefresh} disabled={!isWebview} className={refreshClass} title="Refresh inner window" aria-label="Refresh inner window" type="button">
                    <RefreshIcon />
                  </button>
                </div>
            }
            {
              canAdmin ?
                match.params.coll && <AdminHeader managing={route.managementView} /> :
                <BreadcrumbsUI is404={is404} url={pathname} />
            }
          </div>
          <UserManagement route={route} canAdmin={canAdmin} />
        </nav>
      </header>
    );
  }
}


export default AppHeader;
