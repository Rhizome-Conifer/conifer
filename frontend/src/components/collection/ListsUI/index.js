import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Collapsible from 'react-collapsible';
import classNames from 'classnames';
import { Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import Modal from 'components/Modal';
import { CheckIcon, PlusIcon, XIcon } from 'components/icons';

import ListItem from './ListItem';
import EditItem from './EditItem';

import './style.scss';


class ListsUI extends Component {

  static contextTypes = {
    canAdmin: PropTypes.bool,
    isAnon: PropTypes.bool
  };

  static propTypes = {
    activeListId: PropTypes.string,
    addToList: PropTypes.func,
    collection: PropTypes.object,
    createList: PropTypes.func,
    deleteList: PropTypes.func,
    editList: PropTypes.func,
    getLists: PropTypes.func,
    loaded: PropTypes.bool,
    loading: PropTypes.bool,
    lists: PropTypes.object,
    list: PropTypes.object
  };

  constructor(props) {
    super(props);

    this.state = {
      editModal: false,
      title: '',
      isCreating: false,
      created: false,
      isEditing: false,
      edited: false
    };
  }

  componentWillReceiveProps(nextProps) {
    const { isCreating, created, isEditing, edited } = this.state;

    if (isCreating && !created && this.props.lists !== nextProps.lists) {
      this.setState({ title: '', isCreating: false, created: true });
      setTimeout(() => { this.setState({ created: false, isCreating: false }); }, 3000);
    }

    if (isEditing && !edited && this.props.lists !== nextProps.lists) {
      this.setState({ isEditing: false, edited: true });
      setTimeout(() => { this.setState({ edited: false, isEditing: false, editId: null }); }, 5000);
    }
  }

  handleInput = (evt) => {
    this.setState({
      [evt.target.name]: evt.target.value
    });
  }

  submitCheck = (evt) => {
    if (evt.key === 'Enter') {
      this.createList();
    }
  }

  createList = () => {
    const { collection, createList } = this.props;
    const { title } = this.state;

    if (title) {
      this.setState({ created: false, isCreating: true });
      createList(collection.get('user'), collection.get('id'), title);
    }
  }

  sendDeleteList = (listId) => {
    const { collection } = this.props;
    this.props.deleteList(collection.get('user'), collection.get('id'), listId);
  }

  sendEditList = (listId, data) => {
    const { collection } = this.props;
    this.setState({ edited: false, isEditing: true, editId: listId });
    this.props.editList(collection.get('user'), collection.get('id'), listId, data);
  }

  clearInput = () => this.setState({ title: '' })

  openEditModal = (evt) => {
    evt.stopPropagation();
    this.setState({ editModal: true });
  }

  closeEditModal = () => { this.setState({ editModal: false }); }

  render() {
    const { canAdmin } = this.context;
    const { activeListId, collection, list, lists } = this.props;
    const { created, editModal, isCreating, title, edited, editId } = this.state;

    // wait until collection is loaded
    if (!collection.get('loaded')) {
      return null;
    }

    return (
      <React.Fragment>
        <div className="wr-coll-sidebar">
          <header>Collection Navigator <span role="button" className="sidebar-minimize" onClick={this.minimize}>-</span></header>

          {
            activeListId &&
              <Link to={`/${collection.get('user')}/${collection.get('id')}`} className="button-link">See All Resources in Collection</Link>
          }

          <div className="lists-body">
            <header className="lists-header">
              <h4>Lists</h4>
              {
                canAdmin &&
                  <button onClick={this.openEditModal} className="button-link list-edit">EDIT</button>
              }
            </header>
            <ul>
              {
                lists.map(listObj => (
                  <ListItem
                    addToList={this.props.addToList}
                    collection={collection}
                    editList={this.sendEditList}
                    key={listObj.get('id')}
                    list={listObj}
                    selected={list && listObj.get('id') === activeListId} />
                ))
              }
            </ul>

            {
              canAdmin &&
                <Button onClick={this.openEditModal}>Manage Lists</Button>
            }
          </div>
        </div>

        {
          /* lists edit modal */
          canAdmin &&
            <Modal
              visible={editModal}
              closeCb={this.closeEditModal}
              footer={<Button onClick={this.closeEditModal} bsStyle="success">Done</Button>}
              dialogClassName="lists-edit-modal">
              <ul>
                <li>
                  <button className="borderless" onClick={this.clearInput} disabled={!title.length}><XIcon /></button>
                  <input name="title" className="borderless-input" onKeyPress={this.submitCheck} onChange={this.handleInput} value={title} placeholder="Create new list" autoFocus />
                  {
                    created ?
                      <button className="borderless"><CheckIcon success /></button> :
                      <button className={classNames('borderless', { 'wr-add-list': title.length })} onClick={this.createList} disabled={!title.length || isCreating}><PlusIcon /></button>
                  }
                </li>
                {
                  lists.map(listObj => (
                    <EditItem
                      key={listObj.get('id')}
                      list={listObj}
                      edited={edited && listObj.get('id') === editId}
                      editListCallback={this.sendEditList}
                      deleteListCallback={this.sendDeleteList} />
                  ))
                }
              </ul>
            </Modal>
        }
      </React.Fragment>
    );
  }
}

export default ListsUI;
