import React, { Component } from 'react';
import PropTypes from 'prop-types';

import AutoSizer from 'react-virtualized/dist/commonjs/AutoSizer';
import Column from 'react-virtualized/dist/commonjs/Table/Column';
import Table from 'react-virtualized/dist/commonjs/Table';

import { setSort } from 'redux/modules/collection';
import { getStorage, inStorage, setStorage } from 'helpers/utils';

import SessionCollapsible from 'components/SessionCollapsible';
import DurationFormat from 'components/DurationFormat';
import SizeFormat from 'components/SizeFormat';
import TimeFormat from 'components/TimeFormat';

import 'react-virtualized/styles.css';

import CollectionManagement from './management';
import { BrowserRenderer, LinkRenderer, TagRenderer,
         TimestampRenderer } from './columns';

import './style.scss';


class CollectionDetailUI extends Component {
  static propTypes = {
    bookmarks: PropTypes.object,
    collection: PropTypes.object,
    dispatch: PropTypes.func,
    browsers: PropTypes.object,
    auth: PropTypes.object,
    params: PropTypes.object,
    recordings: PropTypes.object,
    searchText: PropTypes.string,
    searchBookmarks: PropTypes.func
  };

  constructor(props) {
    super(props);

    this.initialState = {
      groupDisplay: true,
      expandAll: false,
      selectedSession: null,
      selectedBookmark: null,
      selectedBookmarkIdx: null,
      selectedGroupedBookmark: null,
      selectedGroupedBookmarkIdx: null,
      bookmarks: props.bookmarks,
      sortBy: null,
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

  onToggle = (e) => {
    let bool;
    if (typeof e.target.checked !== 'undefined') {
      bool = e.target.checked;
    } else {
      bool = !this.state.groupDisplay;
    }

    setStorage('groupDisplay', bool);
    this.setState(Object.assign(this.initialState, {
      groupDisplay: bool,
    }));
  }

  onSelectRow = ({ index, rowData }) => {
    this.setState({
      selectedBookmarkIdx: index,
      selectedBookmark: rowData,
      selectedSession: null
    });
  }

  onSelectGroupedRow = ({ rec, index }) => {
    this.setState({
      selectedSession: rec,
      selectedGroupedBookmark: rec.getIn(['pages', index]),
      selectedGroupedBookmarkIdx: index
    });
  }

  onExpandSession = (sesh) => {
    this.setState({
      selectedBookmark: null,
      selectedGroupedBookmark: null,
      selectedGroupedBookmarkIdx: null,
      selectedSession: sesh
    });
  }

  onCollapseSession = () => {
    this.setState({
      selectedSession: null,
      selectedGroupedBookmark: null,
      selectedGroupedBookmarkIdx: null
    });
  }

  search = (evt) => {
    const { dispatch, searchBookmarks } = this.props;
    console.log('searching', evt.target.value);

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
    console.log(sortBy, sortDirection);

    if (prevSort !== sortBy) {
      dispatch(setSort({ sort: sortBy, dir: sortDirection }));
    } else {
      dispatch(setSort({ sort: sortBy, dir: prevDir === 'ASC' ? 'DESC' : 'ASC' }));
    }
  }

  toggleExpandAllSessions = () => {
    this.setState({ expandAll: !this.state.expandAll });
  }

  render() {
    const { bookmarks, browsers, collection, recordings, searchText } = this.props;
    const { groupDisplay, expandAll, selectedBookmark, selectedBookmarkIdx,
            selectedSession, selectedGroupedBookmark, selectedGroupedBookmarkIdx } = this.state;

    return (
      <div className="wr-coll-detail">
        <header>
          <h1>{collection.get('title')}</h1>
          <hr />
          <p>{collection.get('desc')}</p>
        </header>

        <div className="wr-coll-container">
          <aside className="wr-coll-sidebar-container">
            <div className="wr-coll-sidebar">
              {
                // selected flat bookmark
                selectedBookmark &&
                  <div>
                    Bookmark { selectedBookmarkIdx } selected.<br />
                    <div>
                      {
                        selectedBookmark.entrySeq().map((k) => {
                          return <div key={k[0]}>{ k[0] }: { k[1] }</div>;
                        })
                      }
                    </div>
                  </div>
              }
              {
                // selected session
                selectedSession && !selectedGroupedBookmark && !expandAll &&
                  <div>
                    <b>{selectedSession.get('title')}</b>
                    <div>
                      {`${selectedSession.get('pages').size} bookmark${selectedSession.get('pages').size === 1 ? '' : 's'}`}
                      <SizeFormat bytes={selectedSession.get('size')} />
                    </div>
                    <TimeFormat epoch={selectedSession.get('updated_at')} />
                    <DurationFormat duration={parseInt(selectedSession.get('updated_at'), 10) - parseInt(selectedSession.get('created_at'), 10)} />
                  </div>
              }
              {
                // selected grouped bookmark
                selectedGroupedBookmark &&
                  <div>
                    Bookmark { selectedGroupedBookmarkIdx } selected.<br />
                    <div>
                      {
                        selectedGroupedBookmark.entrySeq().map((k) => {
                          return <div key={k[0]}>{ k[0] }: { k[1] }</div>;
                        })
                      }
                    </div>
                  </div>
              }
              {
                // collection info
                !selectedBookmark && (!selectedSession || (expandAll && !selectedGroupedBookmark)) &&
                  <div>
                    <b>{recordings.size} Recording{ recordings.size === 1 ? '' : 's'}:</b>
                    {
                      recordings.map(rec => <div key={rec.get('id')}>{ rec.get('title')}</div>)
                    }
                  </div>
              }
            </div>
            <div className="wr-coll-sidebar">
              Notes
            </div>
          </aside>
          <div className="wr-coll-utilities">
            <CollectionManagement
              groupDisplay={groupDisplay}
              onToggle={this.onToggle}
              toggleExpandAllSessions={this.toggleExpandAllSessions}
              search={this.search}
              searchText={searchText} />
          </div>
          <div className="wr-coll-detail-table">
            {
              groupDisplay ?
                <div className="wr-coll-session-container">
                  {
                    recordings.map(rec =>
                      <SessionCollapsible
                        key={rec.get('id')}
                        hasActiveBookmark={selectedSession === rec && selectedGroupedBookmarkIdx !== null}
                        collection={collection}
                        browsers={browsers}
                        expandAll={expandAll}
                        onExpand={this.onExpandSession}
                        onCollapse={this.onCollapseSession}
                        recording={rec}
                        onSelectRow={this.onSelectGroupedRow}
                        selectedGroupedBookmarkIdx={selectedGroupedBookmarkIdx} />
                    )
                  }
                </div> :
                <AutoSizer>
                  {
                    ({ height, width }) => (
                      <Table
                        width={width}
                        height={height}
                        rowCount={bookmarks.size}
                        headerHeight={40}
                        rowHeight={50}
                        rowGetter={({ index }) => bookmarks.get(index)}
                        rowClassName={({ index }) => { return index === selectedBookmarkIdx ? 'selected' : ''; }}
                        onRowClick={this.onSelectRow}
                        sort={this.sort}
                        sortBy={collection.getIn(['sortBy', 'sort'])}
                        sortDirection={collection.getIn(['sortBy', 'dir'])}>
                        <Column
                          width={20}
                          dataKey="fav"
                          cellRenderer={() => <span className="glyphicon glyphicon-star" />} />
                        <Column
                          width={20}
                          dataKey="bookmark"
                          cellRenderer={() => <span className="glyphicon glyphicon-bookmark" />} />
                        <Column
                          width={200}
                          label="timestamp"
                          dataKey="timestamp"
                          cellRenderer={TimestampRenderer} />
                        <Column
                          width={200}
                          label="bookmark"
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
                          width={100}
                          label="labels"
                          dataKey="labels"
                          disableSort
                          cellRenderer={TagRenderer} />
                        <Column
                          width={100}
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
    );
  }
}

export default CollectionDetailUI;
