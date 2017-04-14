import React, { Component, PropTypes } from 'react';
import { IndexLink, Link } from 'react-router';
import filter from 'lodash/filter';

import './style.scss';


class Breadcrumb extends Component {

  render() {
    const { routes } = this.props;

    // filter based on whether this item should show up in breadcrumb
    const trail = routes ? filter(routes.slice(1), o => o.breadcrumb) : [];

    return (
      <ol className="breadcrumb navbar-left wr-breadcrumb">
        <IndexLink to="/">Webrecorder</IndexLink>
        {/*
          trail.length &&
          trail.map((item, index) =>
            <li>
              <span>{ item.component.title }</span>
            </li>
          )
          */
        }
      </ol>
    );
  }
}

export default Breadcrumb;
