import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Toggle from 'react-toggle';
import { Alert, ControlLabel, FormGroup, FormControl } from 'react-bootstrap';

import { defaultCollectionTitle } from 'config';
import { collection } from 'helpers/userMessaging';

import Modal from 'components/Modal';


class NewCollection extends Component {
  static propTypes = {
    close: PropTypes.func,
    createCollection: PropTypes.func,
    creatingCollection: PropTypes.bool,
    error: PropTypes.string,
    showModal: PropTypes.bool,
    visible: PropTypes.bool
  };

  constructor(props) {
    super(props);

    this.state = {
      collTitle: defaultCollectionTitle,
      isPublic: false
    };
  }

  submit = (evt) => {
    evt.stopPropagation();
    evt.preventDefault();
    const { collTitle, isPublic } = this.state;

    this.props.createCollection(collTitle, isPublic);
  }

  focusInput = (evt) => {
    this.input.setSelectionRange(0, this.state.collTitle.length);
  }

  handleInput = (evt) => {
    this.setState({ collTitle: evt.target.value });
  }

  togglePublic = (evt) => {
    this.setState({ isPublic: !this.state.isPublic });
  }

  titleValidation = () => {
    return this.props.error ? 'error' : null;
  }

  render() {
    const { close, creatingCollection, error, visible } = this.props;
    const { collTitle, isPublic } = this.state;

    return (
      <Modal
        closeCb={close}
        header="Create New Collection"
        visible={visible}>
        <form onSubmit={this.submit} id="create-coll" className="form-horizontal">
          {
            error &&
              <Alert bsStyle="danger">
                { collection[error] || 'Error encountered' }
              </Alert>
          }
          <FormGroup bsClass="form-group col-xs-5" validationState={this.titleValidation()}>
            <ControlLabel htmlFor="collection">Collection Name:</ControlLabel>
            <FormControl type="text" inputRef={(obj) => { this.input = obj; }} id="title" name="title" onFocus={this.focusInput} onChange={this.handleInput} value={collTitle} />
          </FormGroup>

          <span className="col-xs-6 col-xs-offset-1">
            <div><label htmlFor="public-switch"><span className="glyphicon glyphicon-globe" style={{ marginRight: '4px' }} />Make public (visible to all)?</label></div>
            <Toggle
              id="public-switch"
              defaultChecked={isPublic}
              onChange={this.togglePublic} />
          </span>

          <button className="btn btn-lg btn-primary btn-block" onClick={this.submit} disabled={creatingCollection && !error} type="button">Create</button>
        </form>
      </Modal>
    );
  }
}

export default NewCollection;
