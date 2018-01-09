import React from 'react';
import PropTypes from 'prop-types';

import './style.scss';


function Searchbox(props) {
  const { placeholder, search, searchText } = props;

  return (
    <span className="search-box">
      <input type="text" onChange={search} value={searchText} placeholder={placeholder || 'search'} name="filter" />
      <span className="glyphicon glyphicon-search" />
    </span>
  );
}

Searchbox.propTypes = {
  search: PropTypes.func,
  searchText: PropTypes.string,
  placeholder: PropTypes.string
};

export default Searchbox;
