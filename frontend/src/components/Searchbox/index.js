import React from 'react';
import PropTypes from 'prop-types';
import { Button, FormControl, InputGroup } from 'react-bootstrap';

import { SearchIcon, XIcon } from 'components/icons';

import './style.scss';


function Searchbox(props) {
  const { clear, placeholder, search, searchText } = props;

  return (
    <InputGroup bsClass="input-group search-box">
      <FormControl bsSize="sm" onChange={search} value={searchText} placeholder={placeholder || 'Search'} name="filter" />
      <InputGroup.Button>
        {
          searchText ?
            <Button bsSize="sm" onClick={clear}><XIcon /></Button> :
            <Button bsSize="sm"><SearchIcon /></Button>

        }
      </InputGroup.Button>
    </InputGroup>
  );
}

Searchbox.propTypes = {
  clear: PropTypes.func,
  placeholder: PropTypes.string,
  search: PropTypes.func,
  searchText: PropTypes.string
};

export default Searchbox;
