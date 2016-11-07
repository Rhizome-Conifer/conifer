import React from 'react';
import { Link } from 'react-router';

import './style.scss';


function Navigation() {
  return (
    <nav>
      <Link to='/admin/'>Dashboard</Link>
      <Link to='/admin/users'>Users</Link>
      <Link to='/admin/temp-users'>Temp Users</Link>
      <Link to='/admin/settings'>Settings</Link>
      <a href='/'>Webrecorder</a>
    </nav>
  );
}

export default Navigation;
