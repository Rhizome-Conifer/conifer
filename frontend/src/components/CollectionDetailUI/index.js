import React, { Component } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import AutoSizer from 'react-virtualized/dist/commonjs/AutoSizer';
import Column from 'react-virtualized/dist/commonjs/Table/Column';
import Table from 'react-virtualized/dist/commonjs/Table';
import { Button, ControlLabel, FormControl, FormGroup } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import { setSort } from 'redux/modules/collection';
import { getStorage, inStorage, setStorage, range } from 'helpers/utils';

import SessionCollapsible from 'components/SessionCollapsible';
import Modal from 'components/Modal';
import { CloseIcon } from 'components/icons';

import 'react-virtualized/styles.css';

import CollectionSidebar from './sidebar';
import CollDetailHeader from './header';
import { DefaultRow, DnDRow, DnDSortableRow } from './rows';
import { CollectionManagement } from './management';
import { BrowserRenderer, LinkRenderer, RemoveRenderer, TimestampRenderer } from './columns';

import './style.scss';


class CollectionDetailUI extends Component {
  static propTypes = {
    addPagesToLists: PropTypes.func,
    auth: PropTypes.object,
    browsers: PropTypes.object,
    collection: PropTypes.object,
    deleteColl: PropTypes.func,
    dispatch: PropTypes.func,
    list: PropTypes.object,
    pages: PropTypes.object,
    recordings: PropTypes.object,
    removeBookmark: PropTypes.func,
    saveBookmarkSort: PropTypes.func,
    searchText: PropTypes.string,
    searchPages: PropTypes.func
  };

  static contextTypes = {
    canAdmin: PropTypes.bool,
    isAnon: PropTypes.bool
  }

  constructor(props) {
    super(props);

    this.initialState = {
      addToListModal: false,
      checkedLists: {},
      confirmDelete: '',
      deleteModal: false,
      expandAll: false,
      groupDisplay: false,
      listBookmarks: props.list.get('bookmarks'),
      selectedSession: null,
      selectedPageIdx: null,
      selectedGroupedPageIdx: null,
      selectedRec: null
    };

    this.state = this.initialState;
  }

  componentDidMount() {
    if (inStorage('groupDisplay')) {
      try {
        this.setState({ groupDisplay: JSON.parse(getStorage('groupDisplay')) });
      } catch (e) {
        console.log('Wrong `groupDisplay` storage value');
      }
    }
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.list !== this.props.list) {
      this.setState({ listBookmarks: nextProps.list.get('bookmarks') });
    }
  }

  componentDidUpdate(prevProps, prevState) {
    // detect whether this was a state change to expand recording session view
    if(!prevState.gourpedDisplay && this.state.groupDisplay && this.state.scrollToRec) {
      this.openAndScroll(this.state.scrollToRec);
    }
  }

  onToggle = (e) => {
    let bool;
    if (e && typeof e.target.checked !== 'undefined') {
      bool = e.target.checked;
    } else {
      bool = !this.state.groupDisplay;
    }

    setStorage('groupDisplay', bool);
    this.setState({ ...this.initialState, groupDisplay: bool });
  }

  onSelectRow = ({ event, index, rowData }) => {
    const { selectedPageIdx } = this.state;

    if (selectedPageIdx === index) {
      // clear selection
      this.setState({
        selectedPageIdx: null
      });
    } else {
      let selectedIndex = index;
      if (event.shiftKey && selectedPageIdx !== null) {
        let start;
        let end;

        // if selection is already a range, compute within that
        if (typeof selectedPageIdx !== 'number') {
          const arrMin = Math.min.apply(null, selectedPageIdx);
          const arrMax = Math.max.apply(null, selectedPageIdx);
          start = Math.min(arrMin, index);
          end = Math.max(arrMax, index);
        } else {
          start = Math.min(selectedPageIdx, index);
          end = Math.max(selectedPageIdx, index);
        }

        selectedIndex = range(start, end);
      } else if (event.metaKey && selectedPageIdx !== null) {
        if (typeof selectedPageIdx === "object") {
          selectedIndex = selectedPageIdx;
          if (selectedIndex.includes(index)) {
            selectedIndex.splice(selectedIndex.indexOf(index), 1);
          } else {
            selectedIndex.push(index);
          }
        } else {
          selectedIndex = [selectedPageIdx, index];
        }
      }

      this.setState({
        selectedPageIdx: selectedIndex,
        selectedSession: null
      });
    }
  }

  onSelectGroupedRow = ({ rec, index }) => {
    if (this.state.selectedGroupedPageIdx === index) {
      this.setState({
        selectedSession: rec,
        selectedGroupedPageIdx: null
      });
    } else {
      this.setState({
        selectedSession: rec,
        selectedGroupedPageIdx: index
      });
    }
  }

  onExpandSession = (sesh) => {
    if (!this.state.expandAll) {
      this.setState({
        selectedGroupedPageIdx: null,
        selectedSession: sesh
      });
    }
  }

  onCollapseSession = () => {
    if (this.state.selectedSession) {
      this.setState({
        selectedSession: null,
        selectedGroupedPageIdx: null,
        selectedRec: null
      });
    }
  }

  addToList = () => {
    const { checkedLists, selectedPageIdx } = this.state;
    const { pages } = this.props;

    if (!checkedLists || Object.entries(checkedLists).length === 0 || !selectedPageIdx) {
      return;
    }

    const selectedLists = Object.entries(checkedLists).filter(l => l[1]);
    const lists = selectedLists.map(obj => obj[0]);

    const pagesToAdd = [];

    if (typeof selectedPageIdx === "object") {
      for(const pgIdx of selectedPageIdx) {
        pagesToAdd.push(pages.get(pgIdx));
      }
    } else {
      pagesToAdd.push(pages.get(selectedPageIdx));
    }

    this.props.addPagesToLists(pagesToAdd, lists);
    this.closeAddToList();
  }

  openAndScroll = (sesh) => {
    const index = this.props.recordings.findIndex(o => o.get('id') === sesh.get('id'));
    const top = this.sessionContainer.querySelectorAll('.wr-coll-session')[index].offsetTop;
    this.sessionContainer.scrollTop = top;

    this.setState({
      selectedSession: sesh,
      selectedRec: sesh.get('id'),
      scrollToRec: null
    });
  }

  selectRecording = (sesh) => {
    if (!this.state.groupDisplay) {
      this.setState({ groupDisplay: true, scrollToRec: sesh });
    } else {
      this.openAndScroll(sesh);
    }
  }

  search = (evt) => {
    const { dispatch, searchPages } = this.props;

    // if in group mode, switch to flat display
    if(this.state.groupDisplay) {
      this.onToggle();
    }

    dispatch(searchPages(evt.target.value));
  }

  sort = ({ sortBy, sortDirection }) => {
    const { collection, dispatch } = this.props;
    const prevSort = collection.getIn(['sortBy', 'sort']);
    const prevDir = collection.getIn(['sortBy', 'dir']);

    // clear selected pages
    this.setState({ selectedPageIdx: null });

    if (prevSort !== sortBy) {
      dispatch(setSort({ sort: sortBy, dir: sortDirection }));
    } else {
      dispatch(setSort({ sort: sortBy, dir: prevDir === 'ASC' ? 'DESC' : 'ASC' }));
    }
  }

  toggleExpandAllSessions = () => {
    this.setState({ expandAll: !this.state.expandAll });
  }

  testRowHighlight = ({ index }) => {
    const { selectedPageIdx } = this.state;

    if (!!selectedPageIdx && typeof selectedPageIdx === 'object') {
      return selectedPageIdx.includes(index) ? 'selected' : '';
    }
    return index === selectedPageIdx ? 'selected' : '';
  }

  listCheckbox = (evt) => {
    const { checkedLists } = this.state;

    checkedLists[evt.target.name] = evt.target.checked;

    this.setState({ checkedLists });
  }

  sortBookmark = (origIndex, hoverIndex) => {
    const { listBookmarks } = this.state;
    const o = listBookmarks.get(origIndex);
    const sorted = listBookmarks.splice(origIndex, 1)
                                .splice(hoverIndex, 0, o);

    this.setState({ listBookmarks: sorted });
  }

  saveSort = () => {
    const { list, saveBookmarkSort } = this.props;
    const order = this.state.listBookmarks.map(o => o.get('id')).toArray();
    saveBookmarkSort(list.get('id'), order);
  }

  deleteCollection = () => {
    const { collection } = this.props;
    const { confirmDelete } = this.state;

    if (collection.get('title').match(new RegExp(`^${confirmDelete}$`, 'i'))) {
      this.props.deleteColl();
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

  handleChange = evt => this.setState({ [evt.target.name]: evt.target.value })
  openDeleteModal = () => this.setState({ deleteModal: true })
  closeDeleteModal = () => this.setState({ deleteModal: false, confirmDelete: '' })
  openAddToList = () => this.setState({ addToListModal: true })
  closeAddToList = () => this.setState({ addToListModal: false })

  render() {
    const { canAdmin, isAnon } = this.context;
    const { pages, browsers, collection, list, recordings, searchText, match: { params } } = this.props;
    const {
      addToListModal,
      checkedLists,
      groupDisplay,
      expandAll,
      listBookmarks,
      selectedSession,
      selectedPageIdx,
      selectedGroupedPageIdx,
      selectedRec
    } = this.state;

    // don't render until loaded
    if (!collection.get('loaded')) {
      return null;
    }

    const activeList = Boolean(params.list);
    const objectLabel = activeList ? 'Bookmark' : 'Page';
    const objects = activeList ? listBookmarks : pages;

    // add react-dnd integration
    const customRowRenderer = (props) => {
      if (isAnon) {
        return <DefaultRow {...props} />;
      } else if (activeList) {
        return (
          <DnDSortableRow
            id={props.rowData.get('id')}
            save={this.saveSort}
            sort={this.sortBookmark}
            {...props} />
        );
      }
      return <DnDRow {...props} />;
    };

    return (
      <div className="wr-coll-detail">
        <CollDetailHeader
          activeList={activeList}
          collection={collection}
          list={list} />

        <div className="grid-wrapper">
          <div className="wr-coll-container">

            <CollectionSidebar collection={collection} activeListId={params.list} />

            <div className="wr-coll-utilities">
              <CollectionManagement
                activeList={activeList}
                collection={collection}
                expandAll={expandAll}
                groupDisplay={groupDisplay}
                onDelete={this.openDeleteModal}
                onToggle={this.onToggle}
                openAddToList={this.openAddToList}
                search={this.search}
                searchText={searchText}
                selectedPages={selectedPageIdx !== null}
                toggleExpandAllSessions={this.toggleExpandAllSessions} />
            </div>

            <div className="lists-modifier">
              {
                activeList &&
                  <header className="lists-header">
                    <span>Bookmarks in Selected List</span>
                    <Link to={`/${collection.get('user')}/${collection.get('id')}`}>Back to Collection Index <CloseIcon /></Link>
                  </header>
              }
            </div>
            <div className={classNames('wr-coll-detail-table', { 'with-lists': activeList })}>
              {
                !activeList && groupDisplay ?
                  <div className="wr-coll-session-container" ref={(obj) => { this.sessionContainer = obj; }}>
                    {
                      recordings.map((rec) => {
                        return (
                          <SessionCollapsible
                            key={rec.get('id')}
                            hasActivePage={selectedSession === rec && selectedGroupedPageIdx !== null}
                            collection={collection}
                            browsers={browsers}
                            expand={expandAll || rec.get('id') === selectedRec}
                            onExpand={this.onExpandSession}
                            onCollapse={this.onCollapseSession}
                            recording={rec}
                            onSelectRow={this.onSelectGroupedRow}
                            selectedGroupedPageIdx={selectedGroupedPageIdx} />
                        );
                      })
                    }
                  </div> :
                  <AutoSizer>
                    {
                      ({ height, width }) => (
                        <Table
                          width={
                            /* factor border width */
                            activeList ? width - 8 : width
                          }
                          height={height}
                          rowCount={objects ? objects.size : 0}
                          headerHeight={40}
                          rowHeight={40}
                          rowGetter={({ index }) => objects.get(index)}
                          rowClassName={this.testRowHighlight}
                          onRowClick={this.onSelectRow}
                          rowRenderer={customRowRenderer}
                          sort={activeList ? null : this.sort}
                          sortBy={activeList ? '' : collection.getIn(['sortBy', 'sort'])}
                          sortDirection={activeList ? null : collection.getIn(['sortBy', 'dir'])}>
                          {
                            activeList && canAdmin &&
                              <Column
                                width={40}
                                dataKey="remove"
                                style={{ textAlign: 'center' }}
                                columnData={{
                                  listId: params.list,
                                  removeCallback: this.props.removeBookmark
                                }}
                                cellRenderer={RemoveRenderer} />
                          }
                          <Column
                            width={200}
                            label="timestamp"
                            dataKey="timestamp"
                            cellRenderer={TimestampRenderer} />
                          <Column
                            width={200}
                            label={objectLabel}
                            dataKey="title"
                            flexGrow={1}
                            columnData={{
                              collection,
                              listId: params.list
                            }}
                            cellRenderer={LinkRenderer} />
                          <Column
                            width={200}
                            label="url"
                            dataKey="url"
                            flexGrow={1} />
                          <Column
                            width={150}
                            label="remote browser"
                            dataKey="browser"
                            columnData={{ browsers }}
                            cellRenderer={BrowserRenderer} />
                        </Table>
                      )
                    }
                  </AutoSizer>
              }
            </div>
          </div>
        </div>

        {
          /* add to list modal */
          canAdmin &&
            <React.Fragment>
              <Modal
                visible={addToListModal}
                closeCb={this.closeAddToList}
                dialogClassName="add-to-lists-modal"
                header={<h4>Add to ...</h4>}
                footer={
                  <React.Fragment>
                    <Button disabled style={{ marginRight: 5 }}>Create new list</Button>
                    <Button onClick={this.addToList} bsStyle="success">Save</Button>
                  </React.Fragment>
                }>
                <ul>
                  {
                    collection.get('lists').map((listObj) => {
                      const id = listObj.get('id');
                      return (
                        <li key={id}>
                          <input type="checkbox" onChange={this.listCheckbox} name={id} id={`add-to-list-${id}`} checked={checkedLists[id] || false} />
                          <label htmlFor={`add-to-list-${id}`}>{listObj.get('title')}</label>
                        </li>
                      );
                    })
                  }
                </ul>
              </Modal>
              <Modal
                visible={this.state.deleteModal}
                closeCb={this.closeDeleteModal}
                dialogClassName="wr-delete-modal"
                header={<h4>Confirm Delete Collection</h4>}
                footer={
                  <React.Fragment>
                    <Button onClick={this.closeDeleteModal} style={{ marginRight: 5 }}>Cancel</Button>
                    <Button onClick={this.deleteCollection} disabled={this.validateConfirmDelete() !== 'success'} bsStyle="danger">Confirm Delete</Button>
                  </React.Fragment>
                }>
                <p>
                  Are you sure you want to delete the collection <b>{collection.get('title')}</b> {`/${params.user}/${params.coll}/`}?
                </p>
                <p>
                  If you confirm, <b>all recordings will be permanently deleted</b>.
                </p>
                <p>
                  Be sure to download the collection first if you would like to keep any data.
                </p>
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
        }
      </div>
    );
  }
}

export default CollectionDetailUI;
