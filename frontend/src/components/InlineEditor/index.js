import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Button, ControlLabel, FormControl, FormGroup } from 'react-bootstrap';

import { CheckIcon, XIcon } from 'components/icons';

import './style.scss';


class InlineEditor extends Component {
  static propTypes = {
    initial: PropTypes.string,
    onSave: PropTypes.func,
    label: PropTypes.string,
    success: PropTypes.bool,
    blockDisplay: PropTypes.bool
  };

  static defaultProps = {
    label: '',
    blockDisplay: false
  }

  constructor(props) {
    super(props);

    this.state = {
      editMode: false,
      inputVal: props.initial,
      inputWidth: 'auto'
    };
  }

  componentDidMount() {
    // TODO: delay here needed for css/fonts to resolve.. better way?
    setTimeout(() => {
      this.setState({ inputWidth: this.childContainer.getBoundingClientRect().width });
    }, 1000);
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.success && !nextProps.success) {
      this.setState({ editMode: false });
    }
  }

  componentDidUpdate(lastProps, lastState) {
    if (this.state.editMode && !lastState.editMode) {
      this.focusInput();
    }
  }

  focusInput = () => {
    this.input.focus();
    this.input.setSelectionRange(0, this.state.inputVal.length);
  }

  handleChange = evt => this.setState({ [evt.target.name]: evt.target.value });
  toggleEditMode = () => {
    const { editMode } = this.state;

    this.setState({ editMode: !editMode });
  }

  _save = () => {
    if (this.props.onSave) {
      this.props.onSave(this.state.inputVal);
    } else {
      console.log('No `onSave` method provided..');
    }
  }

  render() {
    const { blockDisplay, label } = this.props;

    return (
      <div className={classNames('wr-inline-editor', { 'block-display': blockDisplay })}>
        {
          this.state.editMode ?
            <div className="form-wrapper" style={blockDisplay ? {} : { width: this.state.inputWidth }}>
              <FormGroup>
                {
                  label &&
                    <ControlLabel>{label}</ControlLabel>
                }
                <FormControl
                  type="text"
                  name="inputVal"
                  inputRef={(obj) => { this.input = obj; }}
                  value={this.state.inputVal}
                  onChange={this.handleChange} />
                <Button bsSize="sm" onClick={this._save} bsStyle={this.props.success ? 'success' : 'default'}><CheckIcon /></Button>
                <Button onClick={this.toggleEditMode} bsSize="sm"><XIcon /></Button>
              </FormGroup>
            </div> :
            <div ref={(obj) => { this.childContainer = obj; }} className="child-container">
              {this.props.children}
              <Button className="wr-inline-edit-button" bsSize="xs" onClick={this.toggleEditMode}>edit</Button>
            </div>
          }
      </div>
    );
  }
}

export default InlineEditor;
