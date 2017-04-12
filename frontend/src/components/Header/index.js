import React from 'react';

import UserManagement from 'components/UserManagement';
import Breadcrumb from 'components/Breadcrumb';

import './style.scss';


/* not in use */
function Header(props) {
  const { auth } = props;

  return (
    <header>
      <div className="navbar navbar-default navbar-static-top">
        <nav className="container-fluid header-webrecorder">
          <Breadcrumb />
          { auth.loaded &&
            <UserManagement auth={auth} />
          }
        </nav>
      </div>
    </header>
  );
}

export default Header;
