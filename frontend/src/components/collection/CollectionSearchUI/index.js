import React, { Component } from 'react';
import PropTypes from 'prop-types';

import { apiFetch } from 'helpers/utils';

import { AdvancedSearch } from 'containers';

import './style.scss';


class CollectionSearchUI extends Component {

  constructor(props) {
    super(props);

    this.state = {
      query: '',
      results: []
    };
  }

  render() {
    const { results } = this.state;

    return (
      <div>
        <AdvancedSearch />
      </div>
    );
  }
}

export default CollectionSearchUI;
