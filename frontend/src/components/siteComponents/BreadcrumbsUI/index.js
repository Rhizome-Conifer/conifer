import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router';
import { Breadcrumbs } from 'react-breadcrumbs-dynamic';

import './style.scss';


class BreadcrumbsUI extends Component {

  render() {
    return (
      <Breadcrumbs
        containerParams={{ style: { display: 'inline-block', margin: '1px 0' } }}
        container="div"
        item={Link}
        finalItem={'span'}
        finalProps={{ style: { color: '#fff' } }}
        separator={<span style={{ color: '#ccc' }}> / </span>} />
    );
  }
}

export default BreadcrumbsUI;
