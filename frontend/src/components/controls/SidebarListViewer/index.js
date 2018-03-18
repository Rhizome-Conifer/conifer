import React, { Component } from 'react';
import PropTypes from 'prop-types';
import AutoSizer from 'react-virtualized/dist/commonjs/AutoSizer';
import ArrowKeyStepper from 'react-virtualized/dist/commonjs/ArrowKeyStepper';
import Column from 'react-virtualized/dist/commonjs/Table/Column';
import Table from 'react-virtualized/dist/commonjs/Table';
import classNames from 'classnames';
import { batchActions } from 'redux-batched-actions';

import { untitledEntry } from 'config';

import { setBookmarkId, updateUrlAndTimestamp } from 'redux/modules/controls';

import { BookmarkRenderer } from './renderers';
import './style.scss';


class SidebarListViewer extends Component {
  static contextTypes = {
    router: PropTypes.object,
  }

  static propTypes = {
    activeBookmark: PropTypes.number,
    bookmarks: PropTypes.object,
    collection: PropTypes.object,
    list: PropTypes.object,
    dispatch: PropTypes.func,
    timestamp: PropTypes.string,
    url: PropTypes.string
  }

  constructor(props) {
    super(props);

    this.state = {
      navigated: false
    };
  }

  componentWillReceiveProps(nextProps) {
    const { activeBookmark, bookmarks, timestamp, url } = this.props;

    // change in iframe source, active bookmark with no bookmark id change
    if ((url !== nextProps.url || timestamp !== nextProps.timestamp) && activeBookmark > -1 && activeBookmark === nextProps.activeBookmark) {
      const bkObj = bookmarks.get(activeBookmark);
      if (bkObj.get('url') !== nextProps.url || bkObj.get('timestamp') !== nextProps.timestamp) {
        this.setState({ navigated: true });
      }
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    if (nextProps.list.equals(this.props.list) &&
        nextProps.activeBookmark === this.props.activeBookmark &&
        nextState.navigated === this.state.navigated) {
      return false;
    }

    return true;
  }

  onKeyNavigate = ({ scrollToRow }) => {
    const { bookmarks, collection, list } = this.props;
    const page = bookmarks.get(scrollToRow);

    // TODO: race condition when keying quickly, old iframe change updates and makes current deselected
    this.setState({ navigated: false });
    this.props.dispatch(batchActions([
      updateUrlAndTimestamp(page.get('url'), page.get('timestamp'), page.get('title') || untitledEntry),
      setBookmarkId(page.get('id'))
    ]));

    // TODO: should we use router to add history changes?
    // this.context.router.history.push(`/${collection.get('user')}/${collection.get('id')}/list/${list.get('id')}-${page.get('id')}/${page.get('timestamp')}/${page.get('url')}`);
  }

  onSelectRow = ({ index, rowData }) => {
    const { collection, list } = this.props;
    this.setState({ navigated: false });
    this.context.router.history.push(`/${collection.get('user')}/${collection.get('id')}/list/${list.get('id')}-${rowData.get('id')}/${rowData.get('timestamp')}/${rowData.get('url')}`);
  }

  rowClass = ({ index }) => {
    const { activeBookmark } = this.props;
    const { navigated } = this.state;

    if (index !== activeBookmark) {
      return '';
    }

    return classNames({
      selected: !navigated,
      'last-selected': navigated
    });
  }

  render() {
    const { activeBookmark, bookmarks, collection, list } = this.props;

    return (
      <div className="bookmark-list">
        <header>
          <h4>{list.get('title')}</h4>
          <hr />
          {
            list.get('desc') &&
              <p>{list.get('desc')}</p>
          }
        </header>
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
                          rowClassName={this.rowClass}
                          onRowClick={this.onSelectRow}
                          onRowsRendered={({ startIndex, stopIndex }) => {
                            onSectionRendered({ rowStartIndex: startIndex, rowStopIndex: stopIndex });
                          }}
                          scrollToIndex={activeBookmark}>
                          <Column
                            label="list bookmarks"
                            dataKey="title"
                            flexGrow={1}
                            width={200}
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

export default SidebarListViewer;
