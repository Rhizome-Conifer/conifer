import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Button, FormControl, InputGroup } from 'react-bootstrap';

import { LoaderIcon, SearchIcon, XIcon } from 'components/icons';

import './style.scss';


class Searchbox extends PureComponent {
  static propTypes = {
    clear: PropTypes.func,
    isIndexing: PropTypes.bool,
    placeholder: PropTypes.string,
    search: PropTypes.func,
    searchText: PropTypes.string
  };

  static getDerivedStateFromProps(nextProps, prevState) {
    if (nextProps.isIndexing && !prevState.indexing) {
      // ignore isIndexing prop switches after first one
      return null;
    }

    return {
      indexing: nextProps.isIndexing
    };
  }

  constructor(props) {
    super(props);

    this.state = {
      indexing: true
    };
  }

  render() {
    const { clear, placeholder, search, searchText } = this.props;
    const { indexing } = this.state;

    return (
      <InputGroup bsClass="input-group search-box" title={indexing ? 'Indexing...' : 'Filter'}>
        <FormControl bsSize="sm" onChange={search} value={searchText} disabled={indexing} placeholder={placeholder || 'Filter'} name="filter" />
        <InputGroup.Button>
          {
            searchText ?
              <Button bsSize="sm" onClick={clear}><XIcon /></Button> :
              <Button bsSize="sm" disabled={indexing}>{indexing ? <LoaderIcon /> : <SearchIcon />}</Button>

          }
        </InputGroup.Button>
      </InputGroup>
    );
  }
}


export default Searchbox;
