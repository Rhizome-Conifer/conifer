import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import { WarcIcon } from 'components/icons';

import './style.scss';


function Capstone({ user }) {
  return (
    <div className="capstone">
      <h4><WarcIcon /> Collection</h4>
      {!__PLAYER__ && <div>by <Link to={`/${user}`}>{user}</Link></div>}
    </div>
  )
}


Capstone.propTypes = {
  user: PropTypes.string
};

export default Capstone;
