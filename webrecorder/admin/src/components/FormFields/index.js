import React, { Component, PropTypes } from 'react';
import { ControlLabel, FormControl, FormGroup} from 'react-bootstrap';
import flatMap from 'lodash/flatMap';

import './style.scss';


class FormFields extends Component {

  static propTypes = {
    items: PropTypes.object,
    modified: PropTypes.func,
  }

  constructor(props) {
    super(props);

    this.handleChange = this.handleChange.bind(this);

    const defaultState = {}
    flatMap(this.props.items, (v,k) => defaultState[k] = v );
    this.state = defaultState;
  }

  handleChange(evt) {
    this.props.modified();
    this.setState({[evt.target.name]: evt.target.value});
  }

  fieldRenderer(k, v, idx) {
    switch(typeof v) {
      default:
      case 'string':
      case 'number':
        return (
          <FormGroup controlId={`field_${k}`} key={`field_${k}`}>
            <ControlLabel>{k.replace(/_/g, ' ')}:</ControlLabel>
            <FormControl type='text'
                         name={k}
                         value={this.state[k]}
                         onChange={this.handleChange} />
          </FormGroup>
        );
    }
  }

  serialize() {
    return this.state;
  }

  render() {
    const { items } = this.props;

    return (
      <div>
        {
          flatMap(items, (v, k, idx) => this.fieldRenderer(k, v, idx))
        }
      </div>
    );
  }
}

export default FormFields;
