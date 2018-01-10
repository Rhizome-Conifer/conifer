import React, { Component } from 'react';
import PropTypes from 'prop-types';
import AutoSizer from 'react-virtualized/dist/commonjs/AutoSizer';
import ArrowKeyStepper from 'react-virtualized/dist/commonjs/ArrowKeyStepper';
import Column from 'react-virtualized/dist/commonjs/Table/Column';
import Table from 'react-virtualized/dist/commonjs/Table';

import { untitledEntry } from 'config';

import { updateUrlAndTimestamp } from 'redux/modules/controls';

import { Collection } from 'components/icons';
import Searchbox from 'components/Searchbox';

import { BookmarkRenderer } from './renderers';

import './style.scss';


class SidebarBookmarkList extends Component {

  static propTypes = {
    activeBookmark: PropTypes.number,
    bookmarks: PropTypes.object,
    dispatch: PropTypes.func,
    searchBookmarks: PropTypes.func,
    searchText: PropTypes.string
  }

  shouldComponentUpdate(nextProps) {
    if (nextProps.bookmarks.equals(this.props.bookmarks) &&
        nextProps.searchText === this.props.searchText &&
        nextProps.activeBookmark === this.props.activeBookmark) {
      return false;
    }

    return true;
  }

  onKeyNavigate = ({ scrollToRow }) => {
    const { bookmarks } = this.props;
    const bookmark = bookmarks.get(scrollToRow);
    this.props.dispatch(updateUrlAndTimestamp(bookmark.get('url'), bookmark.get('timestamp'), bookmark.get('title') || untitledEntry));
  }

  onSelectRow = ({ index, rowData }) => {
    this.props.dispatch(updateUrlAndTimestamp(rowData.get('url'), rowData.get('timestamp'), rowData.get('title') || untitledEntry));
  }

  search = (evt) => {
    const { dispatch, searchBookmarks } = this.props;

    dispatch(searchBookmarks(evt.target.value));
  }

  render() {
    const { activeBookmark, bookmarks, searchText } = this.props;

    return (
      <div className="bookmarks-list">
        <header>
          <Collection />
          <span dangerouslySetInnerHTML={{ __html: ` Collection Bookmarks (${activeBookmark + 1} <em>of</em> ${bookmarks.size})` }} />
        </header>
        <Searchbox
          search={this.search}
          searchText={searchText}
          placeholder="search for pages in index" />
        <div className="bookmarks">
          <AutoSizer>
            {
              ({ height, width }) => (
                <ArrowKeyStepper
                  rowCount={bookmarks.size}
                  columnCount={1}
                  mode="cells"
                  scrollToRow={activeBookmark}
                  onScrollToChange={this.onKeyNavigate}>
                  {
                    ({ onSectionRendered, scrollToRow }) => {
                      return (
                        <Table
                          width={width}
                          height={height}
                          rowCount={bookmarks.size}
                          rowHeight={50}
                          rowGetter={({ index }) => bookmarks.get(index)}
                          rowClassName={({ index }) => { return index === activeBookmark ? 'selected' : ''; }}
                          onRowClick={this.onSelectRow}
                          onRowsRendered={({ startIndex, stopIndex }) => {
                            onSectionRendered({ rowStartIndex: startIndex, rowStopIndex: stopIndex })
                          }}
                          scrollToIndex={activeBookmark}>
                          <Column
                            label="collection bookmarks"
                            dataKey="title"
                            flexGrow={1}
                            width={200}
                            columnData={{ count: bookmarks.size, activeBookmark }}
                            cellRenderer={BookmarkRenderer} />
                        </Table>
                      );
                    }
                  }
                </ArrowKeyStepper>
              )
            }
          </AutoSizer>
        </div>
      </div>
    );
  }
}

export default SidebarBookmarkList;
