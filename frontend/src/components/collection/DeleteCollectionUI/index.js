import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Button, ControlLabel, FormControl, FormGroup } from 'react-bootstrap';

import Modal from 'components/Modal';


class DeleteCollectionUI extends Component {
  static propTypes = {
    children: PropTypes.node,
    collection: PropTypes.object,
    deleteColl: PropTypes.func
  };

  constructor(props) {
    super(props);

    this.state = {
      confirmDelete: '',
      deleteModal: false
    };
  }

  handleChange = evt => this.setState({ [evt.target.name]: evt.target.value })

  toggleDeleteModal = () => this.setState({ deleteModal: !this.state.deleteModal })

  deleteCollection = () => {
    const { collection } = this.props;
    const { confirmDelete } = this.state;

    if (collection.get('title').match(new RegExp(`^${confirmDelete}$`, 'i'))) {
      this.props.deleteColl(collection.get('user'), collection.get('id'));
    }
  }

  validateConfirmDelete = (evt) => {
    const { collection } = this.props;
    const { confirmDelete } = this.state;

    if (!confirmDelete) {
      return null;
    }

    if (confirmDelete && !collection.get('title').match(new RegExp(`^${confirmDelete}$`, 'i'))) {
      return 'error';
    }

    return 'success';
  }

  render() {
    const { collection } = this.props;

    return (
      <React.Fragment>
        <div onClick={this.toggleDeleteModal} style={{ display: 'inline-block' }}>
          {this.props.children}
        </div>
        <Modal
          visible={this.state.deleteModal}
          closeCb={this.toggleDeleteModal}
          dialogClassName="wr-delete-modal"
          header={<h4>Confirm Delete Collection</h4>}
          footer={
            <React.Fragment>
              <Button onClick={this.toggleDeleteModal} style={{ marginRight: 5 }}>Cancel</Button>
              <Button onClick={this.deleteCollection} disabled={this.validateConfirmDelete() !== 'success'} bsStyle="danger">Confirm Delete</Button>
            </React.Fragment>
          }>
          <p>Are you sure you want to delete the collection <b>{collection.get('title')}</b> {`/${collection.get('user')}/${collection.get('id')}/`}?</p>
          <p>If you confirm, <b>all recordings will be permanently deleted</b>.</p>
          <p>Be sure to download the collection first if you would like to keep any data.</p>
          <FormGroup validationState={this.validateConfirmDelete()}>
            <ControlLabel>Type the collection title to confirm:</ControlLabel>
            <FormControl
              id="confirm-delete"
              type="text"
              name="confirmDelete"
              placeholder={collection.get('title')}
              value={this.state.confirmDelete}
              onChange={this.handleChange} />
          </FormGroup>
        </Modal>
      </React.Fragment>
    );
  }
}

export default DeleteCollectionUI;
