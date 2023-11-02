import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Toggle from 'react-toggle';
import { Alert, Button, Form } from 'react-bootstrap';

import config from 'config';
import userMessaging from 'helpers/userMessaging';

import { GlobeIcon } from 'components/icons';

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
      collTitle: config.defaultCollectionTitle,
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
              <Alert variant="danger">
                { userMessaging.collection[error] || 'Error encountered' }
              </Alert>
          }
          <Form.Group bsPrefix="form-group col-xs-5" validationState={this.titleValidation()}>
            <Form.Label htmlFor="collection">Collection Name:</Form.Label>
            <Form.Control id="collection" type="text" ref={(obj) => { this.input = obj; }} name="title" onFocus={this.focusInput} onChange={this.handleInput} value={collTitle} />
          </Form.Group>

          {
            !__DESKTOP__ &&
              <Form.Group>
                <Form.Label htmlFor="public-switch"><GlobeIcon /> Make public (visible to all)?</Form.Label>
                <div>
                  <Toggle
                    id="public-switch"
                    defaultChecked={isPublic}
                    onChange={this.togglePublic} />
                </div>
              </Form.Group>
          }

          <Button variant="primary" block onClick={this.submit} disabled={creatingCollection && !error}>Create</Button>
        </form>
      </Modal>
    );
  }
}

export default NewCollection;
