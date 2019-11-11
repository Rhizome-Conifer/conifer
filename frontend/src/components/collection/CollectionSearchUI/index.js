import React, { Component } from 'react';
import PropTypes from 'prop-types';

import { apiFetch } from 'helpers/utils';

import './style.scss';


class CollectionSearchUI extends Component {

  constructor(props) {
    super(props);

    this.state = {
      query: '',
      results: []
    };
  }

  doSearch = async (evt) => {
    evt.preventDefault();
    const { query } = this.state;

    const res = await apiFetch('/api/v1/search', {
      query
    }, { method: 'POST' });

    if (res) {
      const data = await res.json();
      if (!data.error) {
        this.setState({ results: data.results });
      }
    }
  }

  updateQuery = (evt) => {
    this.setState({ query: evt.target.value });
  }

  render() {
    const { results } = this.state;

    return (
      <div className="search-element">
        <form onSubmit={this.doSearch}>
          <label htmlFor="search">Search:</label>
          <input type="text" onChange={this.updateQuery} id="search" placeholder="entry a query.." />
        </form>
        <ol>
          {
            results.length > 0 &&
              results.map(r => <li>{r}</li>)
          }
        </ol>
      </div>
    );
  }
}

export default CollectionSearchUI;
