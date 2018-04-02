import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Button, ControlLabel, FormControl, FormGroup, HelpBlock } from 'react-bootstrap';

import { CheckIcon, XIcon } from 'components/icons';

import './style.scss';


class InlineEditor extends Component {
  static contextTypes = {
    canAdmin: PropTypes.bool
  };

  static propTypes = {
    blockDisplay: PropTypes.bool,
    canBeEmpty: PropTypes.bool,
    error: PropTypes.string,
    initial: PropTypes.string,
    label: PropTypes.string,
    onSave: PropTypes.func,
    success: PropTypes.bool,
  };

  static defaultProps = {
    blockDisplay: false,
    canBeEmpty: false,
    label: ''
  }

  constructor(props) {
    super(props);

    this.handle = null;
    this.state = {
      editMode: false,
      error: null,
      inputVal: props.initial,
      inputWidth: 'auto'
    };
  }

  componentDidMount() {
    // TODO: delay here needed for css/fonts to resolve.. better way?
    this.handle = setTimeout(() => {
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

  componentWillUnmount() {
    // clear width timeout on unmount
    if (this.handle) {
      clearTimeout(this.handle);
    }
  }

  focusInput = () => {
    this.input.focus();
    this.input.setSelectionRange(0, this.state.inputVal.length);
  }

  handleChange = evt => this.setState({ [evt.target.name]: evt.target.value });
  toggleEditMode = () => {
    const { editMode } = this.state;

    this.setState({ editMode: !editMode, error: null, inputVal: this.props.initial });
  }

  submitCheck = (evt) => {
    if (evt.key === 'Enter') {
      this._save();
    }
  }

  _save = () => {
    const { inputVal } = this.state;

    if (this.props.onSave) {
      // optionally allow sending empty edits
      if ((this.props.canBeEmpty && !inputVal) || inputVal) {
        if (this.state.error) {
          this.setState({ error: null });
        }

        this.props.onSave(this.state.inputVal);
      } else {
        this.setState({ error: 'This field cannot be blank.' });
      }
    } else {
      console.log('No `onSave` method provided..');
    }
  }

  validation = (styles = false) => {
    const { error, success } = this.props;

    if (success) {
      return 'success';
    } else if (error || this.state.error) {
      return styles ? 'danger' : 'error';
    }

    return styles ? 'default' : null;
  }

  render() {
    const { canAdmin } = this.context;
    const { blockDisplay, error, label } = this.props;

    return (
      <div className={classNames('wr-inline-editor', { 'block-display': blockDisplay })}>
        {
          this.state.editMode ?
            <div className="form-wrapper" style={blockDisplay ? {} : { width: this.state.inputWidth }}>
              <FormGroup validationState={this.validation()}>
                {
                  label &&
                    <ControlLabel>{label}</ControlLabel>
                }
                <div className="control-container">
                  <FormControl
                    type="text"
                    name="inputVal"
                    inputRef={(obj) => { this.input = obj; }}
                    value={this.state.inputVal}
                    onChange={this.handleChange}
                    onKeyPress={this.submitCheck} />
                  {
                    (error || this.state.error) &&
                    <div className="help-spanner">
                      <HelpBlock>{ error || this.state.error }</HelpBlock>
                    </div>
                  }
                </div>
                <Button onClick={this._save} bsStyle={this.validation(true)}><CheckIcon /></Button>
                <Button onClick={this.toggleEditMode}><XIcon /></Button>
              </FormGroup>
            </div> :
            <div ref={(obj) => { this.childContainer = obj; }} className="child-container">
              {this.props.children}
              {
                canAdmin &&
                  <Button className="wr-inline-edit-button" bsSize="xs" onClick={this.toggleEditMode}>edit</Button>
              }
            </div>
          }
      </div>
    );
  }
}

export default InlineEditor;
