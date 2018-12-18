import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import memoize from 'memoize-one';
import { Navbar } from 'react-bootstrap';
import { matchPath, NavLink } from 'react-router-dom';

import { AdminHeader, UserManagement } from 'containers';

import BreadcrumbsUI from 'components/siteComponents/BreadcrumbsUI';
import { LogoIcon } from 'components/icons';

import './style.scss';


class AppHeader extends PureComponent {
  static propTypes = {
    authUser: PropTypes.object,
    is404: PropTypes.bool,
    location: PropTypes.object,
    navbarClasses: PropTypes.string
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
    const { authUser, is404, location: { pathname }, navbarClasses } = this.props;
    const { match, route } = this.getActiveMatch(pathname);
    const canAdmin = match && match.params.user === authUser.get('username');

    return (
      <header className={classNames('app-header', { dark: canAdmin })}>
        <Navbar staticTop fluid collapseOnSelect className={navbarClasses} role="navigation">
          <Navbar.Header>
            <NavLink to="/" className="wr-logomark"><LogoIcon darkMode={canAdmin} /></NavLink>
            {
              canAdmin ?
                match.params.coll && <AdminHeader managing={route.managementView} /> :
                <BreadcrumbsUI is404={is404} url={pathname} />
            }
            <Navbar.Toggle />
          </Navbar.Header>
          <Navbar.Collapse>
            <UserManagement />
          </Navbar.Collapse>
        </Navbar>
      </header>
    );
  }
}


export default AppHeader;
