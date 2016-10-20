import React, { Component, PropTypes } from 'react';
import classNames from 'classnames';

import './style.scss';


class Loader extends Component {

  static propTypes = {
    loading: PropTypes.bool,
    transition: PropTypes.bool,
  }

  render() {
    const { loading, transition } = this.props;
    const classes = classNames('loader', {
      'active': loading,
      'transition': transition,
    });

    return (
      <ul className={classes}>
        <li />
      </ul>
    );
  }
}

export default Loader;