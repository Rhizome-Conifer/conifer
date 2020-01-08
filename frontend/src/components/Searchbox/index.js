import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Button, FormControl, InputGroup } from 'react-bootstrap';

import { LoaderIcon, SearchIcon, XIcon } from 'components/icons';

import './style.scss';


class Searchbox extends PureComponent {
  static propTypes = {
    clear: PropTypes.func,
    disabled: PropTypes.bool,
    placeholder: PropTypes.string,
    search: PropTypes.func,
    searching: PropTypes.bool,
    searchText: PropTypes.string
  };

  handleChange = (evt) => {
    // noop while indexing
    if (this.props.searching) {
      return;
    }

    this.props.search(evt);
  }

  render() {
    const { clear, disabled, placeholder, searching, searchText } = this.props;

    return (
      <InputGroup bsClass="input-group search-box" title="Search">
        <FormControl disabled={disabled} aria-label="filter" bsSize="sm" onChange={this.handleChange} value={searchText} placeholder={placeholder || 'Filter'} name="filter" />
        <InputGroup.Button>
          {
            searchText ?
              <Button aria-label="clear" bsSize="sm" onClick={clear}><XIcon /></Button> :
              <Button aria-label="search" bsSize="sm" disabled={searching}>{searching ? <LoaderIcon /> : <SearchIcon />}</Button>
          }
        </InputGroup.Button>
      </InputGroup>
    );
  }
}


export default Searchbox;
