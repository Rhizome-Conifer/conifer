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
    activePage: PropTypes.number,
    pages: PropTypes.object,
    dispatch: PropTypes.func,
    searchPages: PropTypes.func,
    searchText: PropTypes.string
  }

  shouldComponentUpdate(nextProps) {
    if (nextProps.pages.equals(this.props.pages) &&
        nextProps.searchText === this.props.searchText &&
        nextProps.activePage === this.props.activePage) {
      return false;
    }

    return true;
  }

  onKeyNavigate = ({ scrollToRow }) => {
    const { pages } = this.props;
    const page = pages.get(scrollToRow);
    this.props.dispatch(updateUrlAndTimestamp(page.get('url'), page.get('timestamp'), page.get('title') || untitledEntry));
  }

  onSelectRow = ({ index, rowData }) => {
    this.props.dispatch(updateUrlAndTimestamp(rowData.get('url'), rowData.get('timestamp'), rowData.get('title') || untitledEntry));
  }

  search = (evt) => {
    const { dispatch, searchPages } = this.props;

    dispatch(searchPages(evt.target.value));
  }

  render() {
    const { activePage, pages, searchText } = this.props;

    return (
      <div className="bookmarks-list">
        <header>
          <Collection />
          <span dangerouslySetInnerHTML={{ __html: ` Collection Bookmarks (${activePage + 1} <em>of</em> ${pages.size})` }} />
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
                  rowCount={pages.size}
                  columnCount={1}
                  mode="cells"
                  scrollToRow={activePage}
                  onScrollToChange={this.onKeyNavigate}>
                  {
                    ({ onSectionRendered, scrollToRow }) => {
                      return (
                        <Table
                          width={width}
                          height={height}
                          rowCount={pages.size}
                          rowHeight={50}
                          rowGetter={({ index }) => pages.get(index)}
                          rowClassName={({ index }) => { return index === activePage ? 'selected' : ''; }}
                          onRowClick={this.onSelectRow}
                          onRowsRendered={({ startIndex, stopIndex }) => {
                            onSectionRendered({ rowStartIndex: startIndex, rowStopIndex: stopIndex })
                          }}
                          scrollToIndex={activePage}>
                          <Column
                            label="collection bookmarks"
                            dataKey="title"
                            flexGrow={1}
                            width={200}
                            columnData={{ count: pages.size, activePage }}
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
