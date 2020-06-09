import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Button, Form } from 'react-bootstrap';

import { collection as collectionErrors } from 'helpers/userMessaging';

import { CheckIcon, PencilIcon, XIcon } from 'components/icons';

import './style.scss';


class InlineEditor extends PureComponent {
  static propTypes = {
    blockDisplay: PropTypes.bool,
    canAdmin: PropTypes.bool,
    canBeEmpty: PropTypes.bool,
    error: PropTypes.string,
    initial: PropTypes.string,
    label: PropTypes.string,
    onSave: PropTypes.func,
    readOnly: PropTypes.bool,
    success: PropTypes.bool,
  };

  static defaultProps = {
    blockDisplay: false,
    canBeEmpty: false,
    label: '',
    readOnly: false
  };

  static getDerivedStateFromProps(nextProps, prevState) {
    // external input changed, and no local edits.. update
    if (nextProps.initial !== prevState.initial &&
        prevState.initial === prevState.inputVal) {
      return {
        initial: nextProps.initial,
        inputVal: nextProps.initial
      };
    }

    return null;
  }

  constructor(props) {
    super(props);

    this.handle = null;
    this.state = {
      editMode: false,
      error: null,
      initial: props.initial,
      inputVal: props.initial,
      inputWidth: 'auto'
    };
  }

  componentDidMount() {
    if (!this.props.readOnly) {
      this.setState({ inputWidth: this.childContainer.getBoundingClientRect().width });

      const child = this.childContainer.childNodes[0];
      if (child && child.nodeName !== 'BUTTON') {
        const style = window.getComputedStyle(child);
        this.container.style.marginTop = style.marginTop;
        this.container.style.marginBottom = style.marginBottom;
        child.style.margin = 0;
      }
    }
  }

  componentDidUpdate(lastProps, lastState) {
    if (!this.props.readOnly) {
      if (lastProps.success && !this.props.success) {
        this.setState({ editMode: false });
      }

      if (this.state.editMode && !lastState.editMode) {
        this.focusInput();
      } else if (!this.state.editMode && lastState.editMode) {
        const child = this.childContainer.childNodes[0];
        if (child && child.nodeName !== 'BUTTON') {
          child.style.margin = 0;
        }
      }
    }
  }

  focusInput = () => {
    this.input.focus();
    this.input.setSelectionRange(0, this.state.inputVal.length);
  }

  handleChange = evt => this.setState({ [evt.target.name]: evt.target.value });

  submitCheck = (evt) => {
    if (evt.key === 'Enter') {
      this._save();
    }
  }

  toggleEditMode = (evt) => {
    evt.stopPropagation();
    const { editMode } = this.state;

    if (!this.props.canAdmin || this.props.readOnly) {
      return;
    }

    this.setState({ editMode: !editMode, error: null, inputVal: this.props.initial });
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

  validation = () => {
    const { error, success } = this.props;

    if (success) {
      return true;
    } else if (error || this.state.error) {
      return false;
    }

    return null;
  }

  render() {
    const { blockDisplay, canAdmin, error, label, readOnly } = this.props;

    return (
      <div className={classNames('wr-inline-editor', { 'block-display': blockDisplay })} ref={(o) => { this.container = o; }}>
        {
          this.state.editMode ?
            <div key="formWrapper" className="form-wrapper" style={blockDisplay ? {} : { width: this.state.inputWidth }}>
              <Form.Group>
                {
                  label &&
                    <Form.Label>{label}</Form.Label>
                }
                <div className="control-container">
                  <Form.Control
                    type="text"
                    name="inputVal"
                    ref={(obj) => { this.input = obj; }}
                    value={this.state.inputVal}
                    onChange={this.handleChange}
                    onKeyPress={this.submitCheck}
                    isInvalid={this.validation() === false} />
                  {
                    (error || this.state.error) &&
                    <div className="help-spanner">
                      <Form.Control.Feedback type="invalid">{ error ? collectionErrors[error] || 'Error encountered' : this.state.error }</Form.Control.Feedback>
                    </div>
                  }
                </div>
                <Button variant="outline-secondary" aria-label="toggle edit mode" onClick={this.toggleEditMode}><XIcon /></Button>
                <Button variant="primary" aria-label="save" onClick={this._save} isInvalid={this.validation() === false}><CheckIcon /></Button>
              </Form.Group>
            </div> :
            <div key="childWrapper" onClick={this.toggleEditMode} ref={(obj) => { this.childContainer = obj; }} className="child-container">
              {this.props.children}
              {
                canAdmin && !readOnly &&
                  <Button aria-label="edit" className="wr-inline-edit-button borderless"><PencilIcon /></Button>
              }
            </div>
        }
      </div>
    );
  }
}

export default InlineEditor;
