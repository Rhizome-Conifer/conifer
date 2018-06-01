import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Collapsible from 'react-collapsible';
import { Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import { draggableTypes } from 'config';
import { getCollectionLink } from 'helpers/utils';

import Modal from 'components/Modal';
import SidebarHeader from 'components/SidebarHeader';
import VisibilityLamp from 'components/collection/VisibilityLamp';
import { AllPagesIcon, CheckIcon, PlusIcon, XIcon } from 'components/icons';

import ListItem from './ListItem';
import EditItem from './EditItem';

import './style.scss';


class ListsUI extends Component {

  static contextTypes = {
    asPublic: PropTypes.bool,
    canAdmin: PropTypes.bool
  };

  static propTypes = {
    activeListSlug: PropTypes.string,
    addToList: PropTypes.func,
    bulkAddToList: PropTypes.func,
    collection: PropTypes.object,
    collapsibleToggle: PropTypes.func,
    deleting: PropTypes.bool,
    deleteError: PropTypes.oneOfType([
      PropTypes.object,
      PropTypes.string
    ]),
    createList: PropTypes.func,
    deleteList: PropTypes.func,
    editColl: PropTypes.func,
    editList: PropTypes.func,
    history: PropTypes.object,
    lists: PropTypes.object,
    list: PropTypes.object,
    pages: PropTypes.object,
    pageSelection: PropTypes.oneOfType([
      PropTypes.array,
      PropTypes.number,
      PropTypes.object // null
    ]),
    publicIndex: PropTypes.bool,
    sortLists: PropTypes.func
  };

  constructor(props, { asPublic }) {
    super(props);

    const lists = asPublic ? props.lists.filter(l => l.get('public')) : props.lists;
    this.state = {
      editModal: false,
      title: '',
      isCreating: false,
      created: false,
      isEditing: false,
      edited: false,
      lists,
      minimized: false
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

    if (nextProps.lists !== this.props.lists) {
      this.setState({ lists: nextProps.lists });
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
      createList(collection.get('owner'), collection.get('id'), title);
    }
  }

  sendDeleteList = (listId) => {
    const { collection } = this.props;
    this.props.deleteList(collection.get('owner'), collection.get('id'), listId);
  }

  sendEditList = (listId, data) => {
    const { collection } = this.props;
    this.setState({ edited: false, isEditing: true, editId: listId });
    this.props.editList(collection.get('owner'), collection.get('id'), listId, data);
  }

  toggleIndexVisibility = () => {
    const { collection, editColl, publicIndex } = this.props;
    editColl(collection.get('owner'), collection.get('id'), { public_index: !publicIndex });
  }

  clearInput = () => this.setState({ title: '' })

  openEditModal = (evt) => {
    evt.stopPropagation();
    this.setState({ editModal: true });
  }

  closeEditModal = () => {
    if (this.state.title) {
      this.createList();
    }

    this.setState({ editModal: false });
  }

  sortLists = (origIndex, hoverIndex) => {
    const { lists } = this.state;
    const o = lists.get(origIndex);
    const sorted = lists.splice(origIndex, 1)
                        .splice(hoverIndex, 0, o);

    this.setState({ lists: sorted });
  }

  saveListSort = () => {
    const { collection } = this.props;
    const order = this.state.lists.map(o => o.get('id')).toArray();
    this.props.sortLists(collection.get('owner'), collection.get('id'), order);
  }

  minimize = () => {
    this.setState({ minimized: !this.state.minimized });
  }

  pageDropCallback = (page, list, itemType) => {
    const { collection, pages, pageSelection } = this.props;
    const selType = typeof pageSelection;

    let pageIds = [];
    if (selType === 'number') {
      pageIds = [
        itemType === draggableTypes.PAGE_ITEM ?
          pages.get(pageSelection).get('id') :
          pages.get(pageSelection).getIn(['page', 'id'])
      ];
    } else if (selType === 'object' && pageSelection !== null) {
      pageIds = pageSelection.map((pg) => {
        return itemType === draggableTypes.PAGE_ITEM ?
          pages.get(pg).get('id') :
          pages.get(pg).getIn(['page', 'id']);
      });
    }

    // check if currently dragged page is within selection
    // if so, bulk add selection, otherwise add single page
    if (pageSelection === null || selType === 'number' ||
        (selType === 'object' && !pageIds.includes(page.id))) {
      this.props.addToList(collection.get('owner'), collection.get('id'), list, page);
    } else {
      const pagesToAdd = [];
      for(const pgIdx of pageSelection) {
        pagesToAdd.push(
          itemType === draggableTypes.PAGE_ITEM ?
            pages.get(pgIdx).toJS() :
            pages.get(pgIdx).get('page').toJS()
        );
      }
      this.props.bulkAddToList(collection.get('owner'), collection.get('id'), list, pagesToAdd);
    }
  }

  close = () => this.props.collapsibleToggle(false);
  open = () => this.props.collapsibleToggle(true);
  goToIndex = () => {
    const { collection } = this.props;
    if (this.context.canAdmin || collection.get('public_index')) {
      this.props.history.push(getCollectionLink(collection, true));
    }
  }

  render() {
    const { canAdmin } = this.context;
    const { activeListSlug, collection, list, publicIndex } = this.props;
    const { created, editModal, edited, editId, isCreating, lists, title } = this.state;

    // wait until collection is loaded
    if (!collection.get('loaded')) {
      return null;
    }

    const publicListCount = lists.filter(l => l.get('public')).size;

    const header = (
      <SidebarHeader
        collapsible
        label="Collection Navigator"
        callback={this.minimize}
        closed={this.state.minimized} />
    );

    return (
      <React.Fragment>
        <Collapsible
          open
          transitionTime={300}
          easing="ease-in-out"
          classParentString="wr-coll-sidebar"
          trigger={header}
          onOpen={this.open}
          onClose={this.close}>
          <div className={classNames('lists-body', { 'private-coll': !collection.get('public') })}>
            <header className="lists-header">
              <h4><span>Lists</span> ({publicListCount} Public)</h4>
              {
                canAdmin &&
                  <React.Fragment>
                    <button onClick={this.openEditModal} className="button-link list-edit">EDIT</button>
                    <button onClick={this.openEditModal} className="borderless"><PlusIcon /></button>
                  </React.Fragment>
              }
            </header>
            <ul>
              {
                (publicIndex || canAdmin) &&
                  <React.Fragment>
                    <li className={classNames('all-pages', { selected: !activeListSlug })}>
                      <div className={classNames('wrapper', { editable: canAdmin })}>
                        <Link to={getCollectionLink(collection, true)} title="All pages" className="button-link"><AllPagesIcon /> All Pages in Collection</Link>
                        {
                          canAdmin &&
                            <VisibilityLamp
                              callback={this.toggleIndexVisibility}
                              isPublic={publicIndex}
                              label="page index" />
                        }
                      </div>
                    </li>
                    <li className="divider" />
                  </React.Fragment>
              }
              {
                lists.map((listObj, idx) => (
                  <ListItem
                    dropCallback={this.pageDropCallback}
                    collId={collection.get('id')}
                    collUser={collection.get('owner')}
                    editList={this.sendEditList}
                    index={idx}
                    key={listObj.get('id')}
                    list={listObj}
                    selected={list && listObj.get('slug') === activeListSlug}
                    saveSort={this.saveListSort}
                    sort={this.sortLists} />
                ))
              }
            </ul>
          </div>
        </Collapsible>
        {
          /* lists edit modal */
          canAdmin &&
            <Modal
              visible={editModal}
              closeCb={this.closeEditModal}
              footer={<Button onClick={this.closeEditModal} bsStyle="success">Done</Button>}
              dialogClassName="lists-edit-modal">
              <header>
                <button className="borderless" onClick={this.clearInput} disabled={!title.length}><XIcon /></button>
                <input name="title" className="borderless-input" onKeyPress={this.submitCheck} onChange={this.handleInput} value={title} placeholder="Create new list" autoFocus />
                {
                  created ?
                    <button className="borderless"><CheckIcon success /></button> :
                    <button className={classNames('borderless', { 'wr-add-list': Boolean(title.length) })} onClick={this.createList} disabled={!title.length || isCreating} title="Add list"><PlusIcon /></button>
                }
              </header>
              <ul className="lists-modal-list">
                {
                  lists.map(listObj => (
                    <EditItem
                      deleteListCallback={this.sendDeleteList}
                      deleteError={this.props.deleteError}
                      edited={edited && listObj.get('id') === editId}
                      editListCallback={this.sendEditList}
                      isDeleting={this.props.deleting}
                      key={listObj.get('id')}
                      list={listObj} />
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
