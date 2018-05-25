import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Button, FormControl, InputGroup } from 'react-bootstrap';

import { columnLabels } from 'config';
import { capitalize } from 'helpers/utils';

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

  clearCheck = (evt) => {
    if (evt.key === 'Backspace' && !this.props.query) {
      this.props.clear();
    }
  }

  handleInput = (evt) => {
    this.props.updateQuery(evt.target.value);
  }

  render() {
    const { column, query } = this.props;
    const columnLabel = columnLabels[column] || capitalize(column);

    return (
      <InputGroup bsClass="input-group query-box">
        <InputGroup.Addon bsSize="sm">{ `${column}:` }</InputGroup.Addon>
        <FormControl bsSize="sm" onKeyDown={this.clearCheck} onChange={this.handleInput} placeholder={`Filtering by '${columnLabel}'`} inputRef={(ref) => { this.input = ref; }} value={query} />
        <InputGroup.Button>
          <Button bsSize="sm" onClick={this.props.clear}><XIcon /></Button>
        </InputGroup.Button>
      </InputGroup>
    );
  }
}

export default QueryBoxUI;
