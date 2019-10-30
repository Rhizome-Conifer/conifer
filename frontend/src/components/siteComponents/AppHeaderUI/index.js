import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import memoize from 'memoize-one';
import { matchPath, NavLink } from 'react-router-dom';

import { AdminHeader, UserManagement } from 'containers';

import BreadcrumbsUI from 'components/siteComponents/BreadcrumbsUI';
import { LogoIcon } from 'components/icons';

import './style.scss';


class AppHeader extends PureComponent {
  static propTypes = {
    authUser: PropTypes.object,
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

  render() {
    const { authUser, is404, location: { pathname } } = this.props;
    const { match, route } = this.getActiveMatch(pathname);
    const canAdmin = match && match.params.user === authUser.get('username');
    const hostedLink = !__DESKTOP__ && canAdmin ? `/${match.params.user}` : '/';

    return (
      <header className={classNames('app-header', { dark: canAdmin })}>
        <nav className="header-webrecorder" role="navigation">
          <div className="navbar-tools">
            <NavLink to={__DESKTOP__ ? `/${authUser.get('username')}` : hostedLink} className={classNames('wr-logomark', { desktop: __DESKTOP__ })}>
              {
                __DESKTOP__ ?
                  'Webrecorder' :
                  <LogoIcon darkMode={canAdmin} />
              }
            </NavLink>
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
