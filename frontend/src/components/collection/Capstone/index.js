import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import { WarcIcon } from 'components/icons';

import './style.scss';


class Capstone extends PureComponent {
  static propTypes = {
    user: PropTypes.string
  };

  render() {
    const { user } = this.props;
    return (
      <div className="capstone">
        <h4><WarcIcon /> Collection</h4>
        {!__PLAYER__ && <div>by <Link to={`/${user}`}>{user}</Link></div>}
      </div>
    );
  }
}


export default Capstone;
