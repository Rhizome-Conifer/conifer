import React, { Component } from 'react';
import PropTypes from 'prop-types';
import AutoSizer from 'react-virtualized/dist/commonjs/AutoSizer';
import ArrowKeyStepper from 'react-virtualized/dist/commonjs/ArrowKeyStepper';
import Column from 'react-virtualized/dist/commonjs/Table/Column';
import Table from 'react-virtualized/dist/commonjs/Table';
import { batchActions } from 'redux-batched-actions';

import { untitledEntry } from 'config';

import { updateUrlAndTimestamp } from 'redux/modules/controls';
import { setBrowser } from 'redux/modules/remoteBrowsers';

import { Collection } from 'components/icons';
import Searchbox from 'components/Searchbox';

import { PageRenderer } from './renderers';

import './style.scss';


class SidebarPageViewer extends Component {

  static propTypes = {
    activePage: PropTypes.number,
    pages: PropTypes.object,
    dispatch: PropTypes.func,
    searchPages: PropTypes.func,
    searchText: PropTypes.string,
    setInspector: PropTypes.func
  }

  componentWillMount() {
    const { activePage, pages, setInspector } = this.props;
    setInspector(pages.getIn([activePage, 'id']));
  }

  shouldComponentUpdate(nextProps) {
    if (nextProps.pages.equals(this.props.pages) &&
        nextProps.searchText === this.props.searchText &&
        nextProps.activePage === this.props.activePage) {
      return false;
    }

    return true;
  }

  componentDidUpdate(prevProps) {
    const { activePage, pages, setInspector } = this.props;

    if (activePage !== prevProps.activePage) {
      setInspector(pages.getIn([activePage, 'id']));
    }
  }

  onKeyNavigate = ({ scrollToRow }) => {
    const { pages } = this.props;
    const page = pages.get(scrollToRow);
    // this.props.dispatch(updateUrlAndTimestamp(page.get('url'), page.get('timestamp'), page.get('title') || untitledEntry));
    // TODO: add change to history ?
    this.props.dispatch(batchActions([
      updateUrlAndTimestamp(page.get('url'), page.get('timestamp'), page.get('title') || untitledEntry),
      setBrowser(page.get('browser') || null)
    ]));
  }

  onSelectRow = ({ index, rowData }) => {
    // this.props.dispatch(updateUrlAndTimestamp(rowData.get('url'), rowData.get('timestamp'), rowData.get('title') || untitledEntry));
    // TODO: add change to history ?
    this.props.dispatch(batchActions([
      updateUrlAndTimestamp(rowData.get('url'), rowData.get('timestamp'), rowData.get('title') || untitledEntry),
      setBrowser(rowData.get('browser') || null)
    ]));
  }

  search = (evt) => {
    const { dispatch, searchPages } = this.props;

    dispatch(searchPages(evt.target.value));
  }

  render() {
    const { activePage, pages, searchText } = this.props;

    return (
      <div className="page-list">
        <header>
          <Collection />
          <span dangerouslySetInnerHTML={{ __html: ` Collection Pages (${activePage + 1} <em>of</em> ${pages.size})` }} />
        </header>
        <Searchbox
          search={this.search}
          searchText={searchText}
          placeholder="search for pages in index" />
        <div className="pages">
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
                            label="collection pages"
                            dataKey="title"
                            flexGrow={1}
                            width={200}
                            columnData={{ count: pages.size, activePage }}
                            cellRenderer={PageRenderer} />
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

export default SidebarPageViewer;
