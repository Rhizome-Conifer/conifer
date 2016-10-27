import React, { Component } from 'react';
import { Link } from 'react-router';

import Navigation from 'components/Navigation';

import './style.scss';


class Header extends Component {

  shouldComponentUpdate(p,s) {
    return false;
  }

  render() {
    return (
      <header>
        <h1>
          <Link to='/admin'><span>Web</span><span>recorder</span> admin</Link>
        </h1>
        <Navigation />
      </header>
    );
  }
}

export default Header;
