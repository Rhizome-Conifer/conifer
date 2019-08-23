import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import { draggableTypes } from 'config';
import { getCollectionLink, keyIn } from 'helpers/utils';

import Modal from 'components/Modal';
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
    bulkAdding: PropTypes.bool,
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

    this.createHandle = null;
    this.editHandle = null;
    const lists = asPublic ? props.lists.filter(l => l.get('public')) : props.lists;
    this.state = {
      editModal: false,
      title: '',
      isCreating: false,
      created: false,
      isEditing: false,
      edited: false,
      lists
    };
  }

  componentWillReceiveProps(nextProps) {
    const { isCreating, created, isEditing, edited } = this.state;

    if (isCreating && !created && this.props.lists !== nextProps.lists) {
      this.setState({ title: '', isCreating: false, created: true });
      this.createHandle = setTimeout(() => { this.setState({ created: false, isCreating: false }); }, 3000);
    }

    if (isEditing && !edited && this.props.lists !== nextProps.lists) {
      this.setState({ isEditing: false, edited: true });
      this.editHandle = setTimeout(() => { this.setState({ edited: false, isEditing: false, editId: null }); }, 5000);
    }

    if (nextProps.lists !== this.props.lists) {
      this.setState({ lists: nextProps.lists });
    }
  }

  componentWillUnmount() {
    clearTimeout(this.createHandle);
    clearTimeout(this.editHandle);
  }

  clearInput = () => this.setState({ title: '' })

  closeEditModal = () => {
    if (this.state.title) {
      this.createList();
    }

    this.setState({ editModal: false });
  }

  createList = () => {
    const { collection, createList } = this.props;
    const { title } = this.state;

    if (title) {
      this.setState({ created: false, isCreating: true });
      createList(collection.get('owner'), collection.get('id'), title);
    }
  }

  goToIndex = () => {
    const { collection } = this.props;
    if (this.context.canAdmin || collection.get('public_index')) {
      this.props.history.push(getCollectionLink(collection, true));
    }
  }

  handleInput = (evt) => {
    this.setState({
      [evt.target.name]: evt.target.value
    });
  }

  navigate = () => {
    const { collection, history } = this.props;
    history.push(getCollectionLink(collection, true));
  }

  openEditModal = (evt) => {
    evt.stopPropagation();
    this.setState({ editModal: true });
  }

  pageDropCallback = (page, list, itemType) => {
    const { collection, pages, pageSelection } = this.props;
    const selectionType = typeof pageSelection;

    let pageIds = [];
    if (selectionType === 'number') {
      pageIds = [
        itemType === draggableTypes.PAGE_ITEM ?
          pages.get(pageSelection).get('id') :
          pages.get(pageSelection).getIn(['page', 'id'])
      ];
    } else if (selectionType === 'object' && pageSelection !== null) {
      pageIds = pageSelection.map((pg) => {
        return itemType === draggableTypes.PAGE_ITEM ?
          pages.get(pg).get('id') :
          pages.get(pg).getIn(['page', 'id']);
      });
    }

    // check if currently dragged page is within selection
    // if so, bulk add selection, otherwise add single page
    if (pageSelection === null || selectionType === 'number' ||
        (selectionType === 'object' && !pageIds.includes(page.page_id))) {
      this.props.addToList(collection.get('owner'), collection.get('id'), list, page);
    } else {
      const pagesToAdd = [];
      /* eslint-disable */
      for(const pgIdx of pageSelection) {
        pagesToAdd.push(
          itemType === draggableTypes.PAGE_ITEM ?
            pages.get(pgIdx).toJS() :
            pages.get(pgIdx).filterNot(keyIn('id', 'page')).toJS()
        );
      }
      /* eslint-enable */
      this.props.bulkAddToList(collection.get('owner'), collection.get('id'), list, pagesToAdd);
    }
  }

  saveListSort = () => {
    const { collection } = this.props;
    const order = this.state.lists.map(o => o.get('id')).toArray();
    this.props.sortLists(collection.get('owner'), collection.get('id'), order);
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

  sortLists = (origIndex, hoverIndex) => {
    const { lists } = this.state;
    const o = lists.get(origIndex);
    const sorted = lists.splice(origIndex, 1)
                        .splice(hoverIndex, 0, o); // eslint-disable-line

    this.setState({ lists: sorted });
  }

  submitCheck = (evt) => {
    if (evt.key === 'Enter') {
      this.createList();
    }
  }

  toggleIndexVisibility = () => {
    const { collection, editColl, publicIndex } = this.props;
    editColl(collection.get('owner'), collection.get('id'), { public_index: !publicIndex });
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

    return (
      <React.Fragment>
        <div className="wr-coll-sidebar">
          <div className={classNames('lists-body', { 'private-coll': !collection.get('public') })}>
            <ul>
              {
                (publicIndex || canAdmin) &&
                  <li className={classNames('all-pages', { selected: !activeListSlug })} onClick={this.navigate}>
                    <div className={classNames('wrapper', { editable: canAdmin })}>
                      <span className="title" title="All pages"><AllPagesIcon /> Pages ({collection.get('pages').size})</span>
                      {
                        canAdmin && !__DESKTOP__ &&
                          <VisibilityLamp
                            callback={this.toggleIndexVisibility}
                            collPublic={collection.get('public')}
                            isPublic={publicIndex}
                            label="page index" />
                      }
                    </div>
                  </li>
              }

              <li className="lists-header">
                <h4><span>Lists</span> ({publicListCount} Public)</h4>
                {
                  canAdmin &&
                    <React.Fragment>
                      <button onClick={this.openEditModal} className="button-link list-edit" type="button">EDIT</button>
                      <button onClick={this.openEditModal} className="borderless" type="button"><PlusIcon /></button>
                    </React.Fragment>
                }
              </li>

              {
                lists.map((listObj, idx) => (
                  <ListItem
                    bulkAdding={this.props.bulkAdding}
                    collId={collection.get('id')}
                    collPublic={collection.get('public')}
                    collUser={collection.get('owner')}
                    dropCallback={this.pageDropCallback}
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
        </div>
        {
          /* lists edit modal */
          canAdmin &&
            <Modal
              visible={editModal}
              closeCb={this.closeEditModal}
              footer={<Button onClick={this.closeEditModal} bsStyle="success">Done</Button>}
              dialogClassName="lists-edit-modal">
              <header>
                <button className="borderless" onClick={this.clearInput} disabled={!title.length} type="button"><XIcon /></button>
                <input name="title" className="borderless-input" onKeyPress={this.submitCheck} onChange={this.handleInput} value={title} placeholder="Create new list" autoFocus />
                {
                  created ?
                    <button className="borderless" type="button"><CheckIcon success /></button> :
                    <button className={classNames('borderless', { 'wr-add-list': Boolean(title.length) })} onClick={this.createList} disabled={!title.length || isCreating} title="Add list" type="button"><PlusIcon /></button>
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
