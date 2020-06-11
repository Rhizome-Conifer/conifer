import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Button, Col, Form } from 'react-bootstrap';

import { defaultCollDesc } from 'config';
import { collection as collectionErr } from 'helpers/userMessaging';

import { LoaderIcon } from 'components/icons';

import Modal from 'components/Modal';
import WYSIWYG from 'components/WYSIWYG';

import './style.scss';


class EditModal extends Component {
  static propTypes = {
    collection: PropTypes.object,
    closeCb: PropTypes.func,
    desc: PropTypes.string,
    editing: PropTypes.bool,
    edited: PropTypes.bool,
    editCallback: PropTypes.func,
    error: PropTypes.object,
    label: PropTypes.string,
    name: PropTypes.string,
    open: PropTypes.bool,
    readOnlyName: PropTypes.bool
  };

  static defaultProps = {
    readOnlyName: false
  };

  constructor(props) {
    super(props);

    this.handle = null;
    this.state = {
      desc: props.desc,
      indicator: false,
      name: props.name
    };
  }

  shouldComponentUpdate(nextProps) {
    if (!this.props.open && !nextProps.open) {
      return false;
    }

    return true;
  }

  componentDidUpdate(prevProps) {
    if (this.props.open && prevProps.edited && !this.props.edited) {
      clearTimeout(this.handle);
      this.props.closeCb();
    }
  }

  componentWillUnmount() {
    clearTimeout(this.handle);
  }

  edit = (evt) => {
    evt.preventDefault();

    const { name, desc } = this.state;
    const data = { desc };

    // name changed?
    if (name !== this.props.name) {
      data.title = name;
    }

    this.handle = setTimeout(() => this.setState({ indicator: true }), 300);
    this.props.editCallback(data);
  }

  editDesc = (desc) => {
    this.setState({ desc });
  }

  editName = (evt) => {
    this.setState({ name: evt.target.value });
  }

  render() {
    const { editing, error, label } = this.props;

    return (
      <Modal
        visible={this.props.open}
        closeCb={this.props.closeCb}
        dialogClassName="wr-edit-modal"
        header={<Col><h2>Edit {label} Details</h2></Col>}
        footer={
          <React.Fragment>
            <Button variant="outline-secondary" onClick={!editing ? this.props.closeCb : undefined} disabled={editing}>Cancel</Button>
            <Button variant="primary" onClick={!editing ? this.edit : undefined} disabled={editing}>
              {
                editing && this.state.indicator &&
                  <LoaderIcon />
              }
              <span>{ this.props.edited ? 'Saved' : 'Save' }</span>
            </Button>
          </React.Fragment>
        }>
        <Form onSubmit={this.edit}>
          <Form.Group controlId="formHorizontalName" validationState={error ? 'error' : null}>
            <Col as={Form.Label}>
              {label} Name:
            </Col>
            <Col>
              <Form.Control readOnly={this.props.readOnlyName} type="input" onChange={this.editName} value={this.state.name} isInvalid={error} />
              <Form.Control.Feedback type="invalid">{ error && (collectionErr[error] || 'Error encountered') }</Form.Control.Feedback>
            </Col>
          </Form.Group>
          <Form.Group controlId="formHorizontalDesc">
            <Col as={Form.Label}>
              {label} Description:
            </Col>
            <Col>
              <WYSIWYG
                editMode
                externalEditButton
                contentSync={this.editDesc}
                initial={this.props.desc}
                onSave={this.editDesc}
                placeholder={defaultCollDesc} />
            </Col>
          </Form.Group>
        </Form>
      </Modal>);
  }
}

export default EditModal;
