import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Button, Form } from 'react-bootstrap';

import { getCollectionLink } from 'helpers/utils';
import userMessaging from 'helpers/userMessaging';
import { AppContext } from 'store/contexts';

import Modal from 'components/Modal';
import { LoaderIcon } from 'components/icons';

import './style.scss';


class DeleteCollectionUI extends Component {
  static contextType = AppContext;

  static propTypes = {
    children: PropTypes.node,
    collection: PropTypes.object,
    deleting: PropTypes.bool,
    deleteColl: PropTypes.func,
    error: PropTypes.string,
    size: PropTypes.string,
    trigger: PropTypes.node,
    wrapper: PropTypes.func,
  };

  static defaultProps = {
    size: ''
  };

  constructor(props) {
    super(props);

    this.handle = null;
    this.state = {
      confirmDelete: '',
      deleteModal: false,
      indicator: false
    };
  }

  componentWillUnmount() {
    clearTimeout(this.handle);
  }

  handleChange = evt => this.setState({ [evt.target.name]: evt.target.value })

  toggleDeleteModal = () => this.setState({ deleteModal: !this.state.deleteModal })

  deleteCollection = () => {
    const { collection, user } = this.props;
    const { confirmDelete } = this.state;

    if (this.validateConfirmDelete() || this.context.isAnon) {
      this.handle = setTimeout(() => this.setState({ indicator: true }), 300);
      this.props.deleteColl(collection.get('owner'), collection.get('id'), user.get('anon'));
    }
  }

  validateConfirmDelete = (evt) => {
    const { collection } = this.props;
    const { confirmDelete } = this.state;

    if (!confirmDelete) {
      return null;
    }

    if (confirmDelete && collection.get('title').toLowerCase() !== confirmDelete.toLowerCase()) {
      return false;
    }

    return true;
  }

  render() {
    const { isAnon } = this.context;
    const { collection, deleting, error, trigger, wrapper } = this.props;

    const Wrapper = wrapper || Button;

    return (
      <React.Fragment>
        {
          trigger ?
            <div onClick={this.toggleDeleteModal}>{trigger}</div> :
            <Wrapper size={this.props.size} onClick={this.toggleDeleteModal}>
              {this.props.children}
            </Wrapper>
        }
        <Modal
          visible={this.state.deleteModal}
          closeCb={this.toggleDeleteModal}
          dialogClassName="wr-delete-modal"
          header={<h4>Confirm Delete Collection</h4>}
          footer={
            <React.Fragment>
              <Button size="lg" variant="outline-secondary" onClick={!deleting ? this.toggleDeleteModal : undefined} disabled={deleting} style={{ marginRight: 5 }}>Cancel</Button>
              <Button size="lg" onClick={!deleting ? this.deleteCollection : undefined} disabled={!isAnon && (deleting || !this.validateConfirmDelete())} variant="danger">
                {
                  deleting && this.state.indicator &&
                    <LoaderIcon />
                }
                <span>Confirm Delete</span>
              </Button>
            </React.Fragment>
          }>
          <p>Are you sure you want to delete the collection <b>{collection.get('title')}</b> {getCollectionLink(collection)}?</p>
          <p>If you confirm, <b>all recordings will be permanently deleted</b>.</p>
          <p>Be sure to download the collection first if you would like to keep any data.</p>
          {
            !isAnon &&
              <Form.Group>
                <Form.Label>Type the collection title to confirm:</Form.Label>
                <Form.Control
                  autoFocus
                  required
                  disabled={deleting}
                  id="confirm-delete"
                  name="confirmDelete"
                  onChange={this.handleChange}
                  placeholder={collection.get('title')}
                  isInvalid={!this.validateConfirmDelete()}
                  type="text"
                  value={this.state.confirmDelete} />
              </Form.Group>
          }
          {
            error &&
              <Form.Text style={{ color: 'red' }}>{ userMessaging.collection[error] || 'Error encountered' }</Form.Text>
          }
        </Modal>
      </React.Fragment>
    );
  }
}

export default DeleteCollectionUI;
