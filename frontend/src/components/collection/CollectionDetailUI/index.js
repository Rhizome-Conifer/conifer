import React, { Component } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import AutoSizer from 'react-virtualized/dist/commonjs/AutoSizer';
import Column from 'react-virtualized/dist/commonjs/Table/Column';
import Table from 'react-virtualized/dist/commonjs/Table';
import { Link } from 'react-router-dom';

import { setSort } from 'redux/modules/collection';
import { getStorage, inStorage, setStorage, range } from 'helpers/utils';

import { CollectionFilters, CollectionHeader } from 'containers';

import SessionCollapsible from 'components/collection/SessionCollapsible';
import { CloseIcon } from 'components/icons';

import 'react-virtualized/styles.css';

import CollectionSidebar from './sidebar';
import { DefaultRow, DnDRow, DnDSortableRow } from './rows';
import { BrowserRenderer, LinkRenderer, RemoveRenderer, TimestampRenderer } from './columns';

import './style.scss';


class CollectionDetailUI extends Component {
  static propTypes = {
    auth: PropTypes.object,
    browsers: PropTypes.object,
    collection: PropTypes.object,
    deleteRec: PropTypes.func,
    dispatch: PropTypes.func,
    list: PropTypes.object,
    match: PropTypes.object,
    pages: PropTypes.object,
    recordings: PropTypes.object,
    removeBookmark: PropTypes.func,
    saveBookmarkSort: PropTypes.func
  };

  static contextTypes = {
    canAdmin: PropTypes.bool,
    isAnon: PropTypes.bool
  }

  constructor(props) {
    super(props);

    this.initialState = {
      expandAll: false,
      groupDisplay: false,
      listBookmarks: props.list.get('bookmarks'),
      scrolled: false,
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

  shouldComponentUpdate(nextProps) {
    // don't rerender for loading changes
    if (!nextProps.loaded) {
      return false;
    }

    return true;
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


  scrollHandler = ({ clientHeight, scrollHeight, scrollTop }) => {
    if (scrollHeight > clientHeight * 1.25) {
      if (scrollTop > 5 && !this.state.scrolled) {
        this.setState({ scrolled: true });
      } else if (scrollTop < 5 && this.state.scrolled) {
        this.setState({ scrolled: false });
      }
    }
  }

  handleChange = evt => this.setState({ [evt.target.name]: evt.target.value })

  render() {
    const { canAdmin } = this.context;
    const { pages, browsers, collection, recordings, match: { params } } = this.props;
    const { groupDisplay, expandAll, listBookmarks, selectedSession,
            selectedPageIdx, selectedGroupedPageIdx, selectedRec } = this.state;

    // don't render until loaded
    if (!collection.get('loaded')) {
      return null;
    }

    const activeList = Boolean(params.list);
    const objectLabel = activeList ? 'Bookmark' : 'Page';
    const objects = activeList ? listBookmarks : pages;

    // add react-dnd integration
    const customRowRenderer = (props) => {
      if (!canAdmin) {
        return <DefaultRow {...props} />;
      }

      if (activeList) {
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
        <CollectionHeader
          activeList={activeList}
          condensed={this.state.scrolled} />

        <div className="grid-wrapper">
          <div className={classNames('wr-coll-container', { 'with-lists': activeList })}>

            <CollectionSidebar collection={collection} activeListId={params.list} />

            {
              activeList ?
                <div className="lists-modifier">
                  <header className="lists-header">
                    <span>Bookmarks in Selected List</span>
                    <Link to={`/${collection.get('user')}/${collection.get('id')}`}>Back to Collection Index <CloseIcon /></Link>
                  </header>
                </div> :
                <CollectionFilters
                  expandAll={expandAll}
                  groupDisplay={groupDisplay}
                  onToggle={this.onToggle}
                  pages={pages}
                  selectedPageIdx={selectedPageIdx}
                  toggleExpandAllSessions={this.toggleExpandAllSessions} />
            }

            <div className={classNames('wr-coll-detail-table', { 'with-lists': activeList })}>
              {
                !activeList && groupDisplay ?
                  <div className="wr-coll-session-container" ref={(obj) => { this.sessionContainer = obj; }}>
                    {
                      recordings.map((rec) => {
                        return (
                          <SessionCollapsible
                            key={rec.get('id')}
                            deleteRec={this.props.deleteRec}
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
                          onScroll={this.scrollHandler}
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
      </div>
    );
  }
}

export default CollectionDetailUI;
