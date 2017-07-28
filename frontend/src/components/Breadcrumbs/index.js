import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { IndexLink } from 'react-router';
import filter from 'lodash/filter';

import './style.scss';


class Breadcrumbs extends Component {

  static contextTypes = {
    router: PropTypes.object
  }

  render() {
    //console.log(this.props, this.context.router);
    const { routes } = this.context.router;

    // filter based on whether this item should show up in breadcrumb
    const trail = routes ? filter(routes.slice(1), o => o.breadcrumb) : [];

    return (
      <ol className="breadcrumb navbar-left wr-breadcrumb">
        <IndexLink to="/">Webrecorder</IndexLink>
        {
          trail.length &&
          trail.map((item, index) =>
            <li key={item.name}><span>{ item.name }</span></li>
          )
        }
      </ol>
    );
  }
}

export default Breadcrumbs;
