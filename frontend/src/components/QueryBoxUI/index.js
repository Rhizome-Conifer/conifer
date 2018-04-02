import React, { Component } from 'react';
import PropTypes from 'prop-types';

import { Button, FormControl, InputGroup } from 'react-bootstrap';

import { XIcon } from 'components/icons';

import './style.scss';


class QueryBoxUI extends Component {
  static propTypes = {
    clear: PropTypes.func,
    column: PropTypes.string,
    query: PropTypes.string,
    updateQuery: PropTypes.func
  };

  componentDidMount() {
    this.input.focus();
  }

  componentWillUnmount() {
    this.props.clear();
  }

  handleInput = (evt) => {
    this.props.updateQuery(evt.target.value);
  }

  render() {
    const { column, query } = this.props;

    return (
      <InputGroup bsClass="input-group query-box">
        <InputGroup.Addon bsSize="sm">{ `${column}:` }</InputGroup.Addon>
        <FormControl bsSize="sm" onChange={this.handleInput} inputRef={(ref) => { this.input = ref; }} value={query} />
        <InputGroup.Button>
          <Button bsSize="sm" onClick={this.props.clear}><XIcon /></Button>
        </InputGroup.Button>
      </InputGroup>
    );
  }
}

export default QueryBoxUI;
