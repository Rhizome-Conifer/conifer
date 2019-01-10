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
    isIndexing: PropTypes.bool,
    placeholder: PropTypes.string,
    search: PropTypes.func,
    searchText: PropTypes.string
  };

  static getDerivedStateFromProps(nextProps, prevState) {
    if ((nextProps.isIndexing && !prevState.hasIndexed) || (!nextProps.isIndexing && prevState.indexing)) {
      return {
        indexing: nextProps.isIndexing,
        hasIndexed: true
      };
    }
    return null;
  }

  constructor(props) {
    super(props);
    this.state = {
      indexing: false,
      hasIndexed: false
    };
  }

  handleChange = (evt) => {
    // noop while indexing
    if (this.state.indexing) {
      return;
    }

    this.props.search(evt);
  }

  render() {
    const { clear, disabled, placeholder, searchText } = this.props;
    const { indexing } = this.state;

    return (
      <InputGroup bsClass="input-group search-box" title={indexing ? 'Indexing...' : 'Filter'}>
        <FormControl disabled={disabled} aria-label="filter" bsSize="sm" onChange={this.handleChange} onFocus={this.props.index} value={searchText} placeholder={indexing ? 'Indexing...' : placeholder || 'Filter'} name="filter" />
        <InputGroup.Button>
          {
            searchText ?
              <Button aria-label="clear" bsSize="sm" onClick={clear}><XIcon /></Button> :
              <Button aria-label="search" bsSize="sm" disabled={indexing}>{indexing ? <LoaderIcon /> : <SearchIcon />}</Button>
          }
        </InputGroup.Button>
      </InputGroup>
    );
  }
}


export default Searchbox;
