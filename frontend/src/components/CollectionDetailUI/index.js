import React, { Component } from 'react';
import PropTypes from 'prop-types';
import AutoSizer from 'react-virtualized/dist/commonjs/AutoSizer';
import Column from 'react-virtualized/dist/commonjs/Table/Column';
import Table from 'react-virtualized/dist/commonjs/Table';
import ReactMarkdown from 'react-markdown';

import { setSort } from 'redux/modules/collection';
import { getStorage, inStorage, setStorage } from 'helpers/utils';

import SessionCollapsible from 'components/SessionCollapsible';
import DurationFormat from 'components/DurationFormat';
import SizeFormat from 'components/SizeFormat';
import TimeFormat from 'components/TimeFormat';

import 'react-virtualized/styles.css';

import { RecordingSession } from './sidebar';
import CollectionManagement from './management';
import { BrowserRenderer, LinkRenderer, TimestampRenderer } from './columns';

import './style.scss';


class CollectionDetailUI extends Component {
  static propTypes = {
    auth: PropTypes.object,
    bookmarks: PropTypes.object,
    browsers: PropTypes.object,
    collection: PropTypes.object,
    dispatch: PropTypes.func,
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
      selectedBookmark: null,
      selectedBookmarkIdx: null,
      selectedGroupedBookmark: null,
      selectedGroupedBookmarkIdx: null,
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

  onSelectRow = ({ index, rowData }) => {
    if (this.state.selectedBookmarkIdx === index) {
      // clear selection
      this.setState({
        selectedBookmarkIdx: null,
        selectedBookmark: null,
      });
    } else {
      this.setState({
        selectedBookmarkIdx: index,
        selectedBookmark: rowData,
        selectedSession: null
      });
    }
  }

  onSelectGroupedRow = ({ rec, index }) => {
    if (this.state.selectedGroupedBookmarkIdx === index) {
      this.setState({
        selectedSession: rec,
        selectedGroupedBookmark: null,
        selectedGroupedBookmarkIdx: null
      });
    } else {
      this.setState({
        selectedSession: rec,
        selectedGroupedBookmark: rec.getIn(['pages', index]),
        selectedGroupedBookmarkIdx: index
      });
    }
  }

  onExpandSession = (sesh) => {
    if (!this.state.expandAll) {
      this.setState({
        selectedBookmark: null,
        selectedGroupedBookmark: null,
        selectedGroupedBookmarkIdx: null,
        selectedSession: sesh
      });
    }
  }

  onCollapseSession = () => {
    if (this.state.selectedSession) {
      this.setState({
        selectedSession: null,
        selectedGroupedBookmark: null,
        selectedGroupedBookmarkIdx: null,
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
    const { canAdmin } = this.context;
    const { bookmarks, browsers, collection, recordings, searchText } = this.props;
    const { groupDisplay, expandAll, selectedBookmark, selectedBookmarkIdx,
            selectedSession, selectedGroupedBookmark, selectedGroupedBookmarkIdx,
            selectedRec } = this.state;

    return (
      <div className="wr-coll-detail">
        <header>
          <h1>{collection.get('title')}</h1>
          <hr />
          <ReactMarkdown className="coll-desc" source={collection.get('desc')} />
        </header>

        <div className="grid-wrapper">
          <div className="wr-coll-container">
            <aside className="wr-coll-sidebar-container">
              <div className="wr-coll-sidebar">
                {
                  // selected flat bookmark
                  selectedBookmark &&
                    <div>
                      <h4>Bookmark #{ selectedBookmarkIdx + 1 } of {collection.get('bookmarks').size } selected.</h4>
                      <div>
                        <h5>{selectedBookmark.get('title')}</h5>
                        <TimeFormat dt={selectedBookmark.get('timestamp')} />
                      </div>
                    </div>
                }
                {
                  // selected session
                  selectedSession && !selectedGroupedBookmark && !expandAll &&
                    <div>
                      <h4>{selectedSession.get('title')}</h4>
                      <div>
                        {`${selectedSession.get('pages').size} bookmark${selectedSession.get('pages').size === 1 ? '' : 's'}`}
                        &nbsp;&ndash;&nbsp;<SizeFormat bytes={selectedSession.get('size')} />
                      </div>
                      <TimeFormat epoch={selectedSession.get('updated_at')} />
                      <div>Dur. <DurationFormat duration={parseInt(selectedSession.get('updated_at'), 10) - parseInt(selectedSession.get('created_at'), 10)} /></div>
                    </div>
                }
                {
                  // selected grouped bookmark
                  selectedGroupedBookmark &&
                    <div>
                      <h4>Bookmark #{ selectedGroupedBookmarkIdx + 1} of {selectedSession.size} selected.</h4>
                      <div>
                        <h5>{selectedGroupedBookmark.get('title')}</h5>
                        <TimeFormat dt={selectedGroupedBookmark.get('timestamp')} />
                      </div>
                    </div>
                }
                {
                  // collection info
                  !selectedBookmark && (!selectedSession || (expandAll && !selectedGroupedBookmark)) &&
                    <div>
                      <div className="recording-session-count">{recordings.size} Recording{ recordings.size === 1 ? '' : 's'}:</div>
                      {
                        recordings.map((rec) => {
                          return (
                            <RecordingSession
                              key={rec.get('id')}
                              rec={rec}
                              select={this.selectRecording} />
                          );
                        })
                      }
                    </div>
                }
              </div>
            </aside>
            <div className="wr-coll-utilities">
              <CollectionManagement
                expandAll={expandAll}
                groupDisplay={groupDisplay}
                onToggle={this.onToggle}
                toggleExpandAllSessions={this.toggleExpandAllSessions}
                search={this.search}
                searchText={searchText} />
            </div>
            <div className="wr-coll-detail-table">
              {
                groupDisplay ?
                  <div className="wr-coll-session-container" ref={(obj) => { this.sessionContainer = obj; }}>
                    {
                      recordings.map((rec) => {
                        return (
                          <SessionCollapsible
                            key={rec.get('id')}
                            hasActiveBookmark={selectedSession === rec && selectedGroupedBookmarkIdx !== null}
                            collection={collection}
                            browsers={browsers}
                            expand={expandAll || rec.get('id') === selectedRec}
                            onExpand={this.onExpandSession}
                            onCollapse={this.onCollapseSession}
                            recording={rec}
                            onSelectRow={this.onSelectGroupedRow}
                            selectedGroupedBookmarkIdx={selectedGroupedBookmarkIdx} />
                        );
                      })
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
                          {
                            canAdmin &&
                              <Column
                                width={20}
                                dataKey="fav"
                                cellRenderer={() => <span className="glyphicon glyphicon-star" />} />
                          }
                          {
                            canAdmin &&
                              <Column
                                width={20}
                                dataKey="bookmark"
                                cellRenderer={() => <span className="glyphicon glyphicon-bookmark" />} />
                          }
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
