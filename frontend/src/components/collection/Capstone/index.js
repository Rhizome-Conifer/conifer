import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import classNames from 'classnames';

import { WarcIcon } from 'components/icons';

import './style.scss';


class Capstone extends PureComponent {
  static propTypes = {
    title: PropTypes.string,
    user: PropTypes.string
  };

  render() {
    const { title, user } = this.props;
    const userLink = !__PLAYER__ && <div className="user-link">by <Link to={`/${user}`}>{user}</Link></div>;

    return (
      <div className={classNames('capstone', { 'has-title': title })}>
        {
          title ?
            <React.Fragment>
              <WarcIcon />
              <div className="capstone-column">
                <h3>{title}</h3>
                {userLink}
              </div>
            </React.Fragment> :
            <React.Fragment>
              <h4><WarcIcon /> Collection</h4>
              {userLink}
            </React.Fragment>
        }
      </div>
    );
  }
}


export default Capstone;
