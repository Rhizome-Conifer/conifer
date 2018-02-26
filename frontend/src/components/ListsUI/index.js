import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import Collapsible from 'react-collapsible';

import Modal from 'components/Modal';
import { CheckIcon, PlusIcon, XIcon } from 'components/icons';

import ListItem from './ListItem';
import EditItem from './EditItem';

import './style.scss';


class ListsUI extends Component {

  static contextTypes = {
    canAdmin: PropTypes.bool
  };

  static propTypes = {
    activeList: PropTypes.string,
    addToList: PropTypes.func,
    collection: PropTypes.object,
    createList: PropTypes.func,
    deleteList: PropTypes.func,
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
      created: false
    };
  }

  componentWillReceiveProps(nextProps) {
    const { isCreating, created } = this.state;

    if (isCreating && !created && this.props.lists !== nextProps.lists) {
      this.setState({ isCreating: false, created: true });

      // clear
      setTimeout(() => { this.setState({ title: '', created: false, isCreating: false }); }, 3000);
    }
  }

  handleInput = (evt) => {
    this.setState({
      [evt.target.name]: evt.target.value
    });
  }

  createList = () => {
    const { collection, createList } = this.props;
    const { title } = this.state;

    if (title) {
      this.setState({ created: false, isCreating: true });
      createList(collection.get('user'), collection.get('id'), title);
    }
  }

  sendDeleteList = (list_id) => {
    const { collection } = this.props;
    this.props.deleteList(collection.get('user'), collection.get('id'), list_id);
  }

  clearInput = () => this.setState({ title: '' })
  openEditModal = (evt) => { evt.stopPropagation(); this.setState({ editModal: true }); }
  closeEditModal = () => { console.log('close'); this.setState({ editModal: false }); }

  render() {
    const { canAdmin } = this.context;
    const { activeList, collection, list, lists } = this.props;
    const { created, editModal, isCreating, title } = this.state;

    // wait until collection is loaded
    if (!collection.get('loaded')) {
      return null;
    }

    const collapsibleHeader = (
      <header className="lists-header">
        <div>
          <span className="glyphicon glyphicon-triangle-right" />
          <h4>Lists</h4>
        </div>
        {
          canAdmin &&
            <button onClick={this.openEditModal} className="button-link list-edit">EDIT</button>
        }
      </header>
    );

    return (
      <React.Fragment>
        <div className="wr-coll-sidebar">
          <header>Collection Navigator <span role="button" className="sidebar-minimize" onClick={this.minimize}>-</span></header>

          {
            activeList &&
              <Link to={`/${collection.get('user')}/${collection.get('id')}`} className="button-link">See All Resources in Collection</Link>
          }

          <div className="lists-body">
            <Collapsible
              lazyRender
              open
              easing="ease-out"
              trigger={collapsibleHeader}>
              <ul>
                {
                  lists.map(listObj => (
                    <ListItem
                      key={listObj.get('id')}
                      selected={list && listObj.get('id') === activeList}
                      list={listObj}
                      collection={collection}
                      addToList={this.props.addToList} />
                  ))
                }
              </ul>
            </Collapsible>

            {
              canAdmin &&
                <button onClick={this.openEditModal}>+ new list</button>
            }
          </div>
        </div>

        {
          canAdmin &&
            <Modal
              visible={editModal}
              closeCb={this.closeEditModal}
              footer={<button onClick={this.closeEditModal}>Done</button>}
              dialogClassName="lists-edit-modal">
              <ul>
                <li>
                  <button className="borderless" onClick={this.clearInput} disabled={!title.length}><XIcon /></button>
                  <input name="title" className="borderless-input" onChange={this.handleInput} value={title} placeholder="Create new list" />
                  {
                    created ?
                      <button className="borderless"><CheckIcon success /></button> :
                      <button className="borderless" onClick={this.createList} disabled={!title.length || isCreating}><PlusIcon /></button>
                  }
                </li>
                {
                  lists.map(listObj => (
                    <EditItem
                      key={listObj.get('id')}
                      list={listObj}
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
