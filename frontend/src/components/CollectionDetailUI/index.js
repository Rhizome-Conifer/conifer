import React, { Component } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import AutoSizer from 'react-virtualized/dist/commonjs/AutoSizer';
import Column from 'react-virtualized/dist/commonjs/Table/Column';
import Table from 'react-virtualized/dist/commonjs/Table';
import { Link } from 'react-router-dom';

import { setSort } from 'redux/modules/collection';
import { getStorage, inStorage, setStorage, range } from 'helpers/utils';

import SessionCollapsible from 'components/SessionCollapsible';
import Modal from 'components/Modal';
import { CloseIcon } from 'components/icons';

import 'react-virtualized/styles.css';

import CollectionSidebar from './sidebar';
import CollDetailHeader from './header';
import DnDRow from './rows';
import { CollectionManagement } from './management';
import { BrowserRenderer, LinkRenderer, TimestampRenderer } from './columns';

import './style.scss';


class CollectionDetailUI extends Component {
  static propTypes = {
    addItemsToLists: PropTypes.func,
    auth: PropTypes.object,
    bookmarks: PropTypes.object,
    browsers: PropTypes.object,
    collection: PropTypes.object,
    dispatch: PropTypes.func,
    list: PropTypes.object,
    recordings: PropTypes.object,
    searchText: PropTypes.string,
    searchBookmarks: PropTypes.func
  };

  static contextTypes = {
    canAdmin: PropTypes.bool,
  }

  constructor(props) {
    super(props);

    this.initialState = {
      groupDisplay: false,
      expandAll: false,
      selectedSession: null,
      selectedPageIdx: null,
      selectedGroupedPageIdx: null,
      selectedRec: null,
      addToListModal: false,
      checkedLists: {}
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
    this.setState(Object.assign(this.initialState, {
      groupDisplay: bool,
    }));
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
    const { bookmarks } = this.props;

    if (!checkedLists || Object.entries(checkedLists).length === 0 || !selectedPageIdx) {
      return;
    }

    const selectedLists = Object.entries(checkedLists).filter(l => l[1]);
    const lists = selectedLists.map(obj => obj[0]);

    const pages = [];

    if (typeof selectedPageIdx === "object") {
      for(const pgIdx of selectedPageIdx) {
        pages.push(bookmarks.get(pgIdx));
      }
    } else {
      pages.push(bookmarks.get(selectedPageIdx));
    }

    this.props.addItemsToLists(pages, lists);
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
    const { dispatch, searchBookmarks } = this.props;

    // if in group mode, switch to flat display
    if(this.state.groupDisplay) {
      this.onToggle();
    }

    dispatch(searchBookmarks(evt.target.value));
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

  openAddToList = () => this.setState({ addToListModal: true })
  closeAddToList = () => this.setState({ addToListModal: false })

  render() {
    const { canAdmin } = this.context;
    const { bookmarks, browsers, collection, list, recordings, searchText, match: { params } } = this.props;
    const { addToListModal, checkedLists, groupDisplay, expandAll, selectedSession, selectedPageIdx,
            selectedGroupedPageIdx, selectedRec } = this.state;

    // don't render until loaded
    if (!collection.get('loaded')) {
      return null;
    }

    const objectLabel = params.list ? 'Bookmark' : 'Page';
    const objects = params.list ? list.get('bookmarks') : bookmarks;

    // add react-dnd integration
    const customRowRenderer = (props) => {
      return <DnDRow {...props} />;
    };

    return (
      <div className="wr-coll-detail">
        <CollDetailHeader
          activeList={params.list}
          collection={collection}
          list={list} />

        <div className="grid-wrapper">
          <div className="wr-coll-container">

            <CollectionSidebar collection={collection} activeList={params.list} />

            <div className="wr-coll-utilities">
              <CollectionManagement
                expandAll={expandAll}
                groupDisplay={groupDisplay}
                onToggle={this.onToggle}
                activeList={Boolean(params.list)}
                toggleExpandAllSessions={this.toggleExpandAllSessions}
                search={this.search}
                searchText={searchText}
                selectedPages={selectedPageIdx !== null}
                openAddToList={this.openAddToList} />
            </div>

            <div className="lists-modifier">
              {
                params.list &&
                  <header className="lists-header">
                    <span>Bookmarks in Selected List</span>
                    <Link to={`/${collection.get('user')}/${collection.get('id')}`}>Back to Collection Index <CloseIcon /></Link>
                  </header>
              }
            </div>
            <div className={classNames('wr-coll-detail-table', { 'with-lists': params.list })}>
              {
                !params.list && groupDisplay ?
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
                            params.list ? width - 8 : width
                          }
                          height={height}
                          rowCount={objects.size}
                          headerHeight={40}
                          rowHeight={50}
                          rowGetter={({ index }) => objects.get(index)}
                          rowClassName={this.testRowHighlight}
                          onRowClick={this.onSelectRow}
                          rowRenderer={customRowRenderer}
                          sort={this.sort}
                          sortBy={collection.getIn(['sortBy', 'sort'])}
                          sortDirection={collection.getIn(['sortBy', 'dir'])}>
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
                            columnData={{ collection }}
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
          canAdmin &&
            <Modal
              visible={addToListModal}
              closeCb={this.closeAddToList}
              dialogClassName="add-to-lists-modal"
              header={<h4>Add to ...</h4>}
              footer={
                <React.Fragment>
                  <button>Create new list</button>
                  <button onClick={this.addToList}>Save</button>
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
        }
      </div>
    );
  }
}

export default CollectionDetailUI;
