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
import { CloseIcon } from 'components/icons';

import 'react-virtualized/styles.css';

import CollectionManagement from './management';
import CollectionSidebar from './sidebar';
import CollDetailHeader from './header';
import { BrowserRenderer, LinkRenderer, TimestampRenderer } from './columns';

import './style.scss';


class CollectionDetailUI extends Component {
  static propTypes = {
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

  onSelectRow = ({ event, index, rowData }) => {
    const { selectedPageIdx } = this.state;

    if (selectedPageIdx === index) {
      // clear selection
      this.setState({
        selectedPageIdx: null
      });
    } else {
      let selectedIndex = index;
      if (event.shiftKey && selectedPageIdx !== null && selectedPageIdx !== index) {
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

  render() {
    const { canAdmin } = this.context;
    const { bookmarks, browsers, collection, list, recordings, searchText } = this.props;
    const { groupDisplay, expandAll, selectedSession,
            selectedGroupedPageIdx, selectedRec } = this.state;

    // don't render until loaded
    if (!collection.get('loaded')) {
      return null;
    }

    return (
      <div className="wr-coll-detail">
        <CollDetailHeader collection={collection} list={list} />

        <div className="grid-wrapper">
          <div className="wr-coll-container">

            <CollectionSidebar collection={collection} list={list} />

            <div className="wr-coll-utilities">
              <CollectionManagement
                expandAll={expandAll}
                groupDisplay={groupDisplay}
                onToggle={this.onToggle}
                listActive={Boolean(list)}
                toggleExpandAllSessions={this.toggleExpandAllSessions}
                search={this.search}
                searchText={searchText} />
            </div>

            <div className="lists-modifier">
              {
                list &&
                  <header className="lists-header">
                    <span>Bookmarks in Selected List</span>
                    <Link to={`/${collection.get('user')}/${collection.get('id')}`}>Back to Collection Index <CloseIcon /></Link>
                  </header>
              }
            </div>
            <div className={classNames('wr-coll-detail-table', { 'with-lists': list })}>
              {
                groupDisplay ?
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
                            list ? width - 8 : width
                          }
                          height={height}
                          rowCount={bookmarks.size}
                          headerHeight={40}
                          rowHeight={50}
                          rowGetter={({ index }) => bookmarks.get(index)}
                          rowClassName={this.testRowHighlight}
                          onRowClick={this.onSelectRow}
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
