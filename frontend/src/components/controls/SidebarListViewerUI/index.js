import React, { Component } from 'react';
import PropTypes from 'prop-types';
import AutoSizer from 'react-virtualized/dist/commonjs/AutoSizer';
import ArrowKeyStepper from 'react-virtualized/dist/commonjs/ArrowKeyStepper';
import Column from 'react-virtualized/dist/commonjs/Table/Column';
import Table from 'react-virtualized/dist/commonjs/Table';
import classNames from 'classnames';
import { Link } from 'react-router-dom';
import { batchActions } from 'redux-batched-actions';

import { untitledEntry } from 'config';
import { remoteBrowserMod } from 'helpers/utils';

import { setBookmarkId, updateUrlAndTimestamp } from 'redux/modules/controls';
import { setBrowser } from 'redux/modules/remoteBrowsers';

import InlineEditor from 'components/InlineEditor';
import SidebarHeader from 'components/SidebarHeader';
import Truncate from 'components/Truncate';
import WYSIWYG from 'components/WYSIWYG';
import { CatalogIcon, ListIcon } from 'components/icons';

import { BookmarkRenderer } from './renderers';
import './style.scss';


class SidebarListViewer extends Component {
  static contextTypes = {
    canAdmin: PropTypes.bool,
    router: PropTypes.object,
  }

  static propTypes = {
    activeBookmark: PropTypes.number,
    bookmarks: PropTypes.object,
    collection: PropTypes.object,
    list: PropTypes.object,
    listEdited: PropTypes.bool,
    dispatch: PropTypes.func,
    editList: PropTypes.func,
    setInspector: PropTypes.func,
    showNavigator: PropTypes.func,
    timestamp: PropTypes.string,
    url: PropTypes.string
  }

  constructor(props) {
    super(props);

    this.state = {
      navigated: false
    };
  }

  componentWillMount() {
    const { activeBookmark, bookmarks, setInspector } = this.props;
    setInspector(bookmarks.getIn([activeBookmark, 'id']));
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
    if (nextProps === this.props &&
        nextState.navigated === this.state.navigated) {
      return false;
    }

    return true;
  }

  componentDidUpdate(prevProps) {
    const { activeBookmark, bookmarks, setInspector } = this.props;
    if (activeBookmark !== prevProps.activeBookmark) {
      setInspector(bookmarks.getIn([activeBookmark, 'id']));
    }
  }

  onKeyNavigate = ({ scrollToRow }) => {
    const { bookmarks, collection, list } = this.props;
    const page = bookmarks.get(scrollToRow);

    // TODO: race condition when keying quickly, old iframe change updates and makes current deselected
    this.setState({ navigated: false });
    this.props.dispatch(batchActions([
      updateUrlAndTimestamp(page.get('url'), page.get('timestamp'), page.get('title') || untitledEntry),
      setBrowser(page.get('browser') || null),
      setBookmarkId(page.get('id'))
    ]));

    // TODO: should we use router to add history changes?
    // const tsMod = remoteBrowserMod(page.get('browser'), page.get('timestamp'), '/');
    // this.context.router.history.push(`/${collection.get('user')}/${collection.get('id')}/list/${list.get('id')}-${page.get('id')}/${tsMod}${page.get('url')}`);
  }

  onSelectRow = ({ index, rowData }) => {
    const { collection, list } = this.props;
    this.setState({ navigated: false });
    const tsMod = remoteBrowserMod(rowData.get('browser'), rowData.get('timestamp'), '/');
    this.context.router.history.push(`/${collection.get('user')}/${collection.get('id')}/list/${list.get('id')}-${rowData.get('id')}/${tsMod}${rowData.get('url')}`);
  }

  getRowClass = ({ index }) => {
    const { activeBookmark } = this.props;
    const { navigated } = this.state;

    if (index !== activeBookmark) {
      return index % 2 !== 0 ? 'odd' : '';
    }

    return classNames({
      odd: index % 2 !== 0,
      selected: !navigated,
      'last-selected': navigated
    });
  }

  editListTitle = (title) => {
    const { collection, list } = this.props;
    this.props.editList(collection.get('user'), collection.get('id'), list.get('id'), { title });
  }

  editListDesc = (desc) => {
    const { collection, list } = this.props;
    this.props.editList(collection.get('user'), collection.get('id'), list.get('id'), { desc });
  }

  returnToCollection = () => this.props.showNavigator(true)

  render() {
    const { activeBookmark, bookmarks, collection, list } = this.props;

    return (
      <div className="bookmark-list">
        <SidebarHeader label="Collection Navigator" />
        <nav>
          <button onClick={this.returnToCollection} className="borderless">&larr; collection main</button>
          <Link to={`/${collection.get('user')}/${collection.get('id')}/list/${list.get('id')}`}>catalog view <CatalogIcon /></Link>
        </nav>
        <header className="list-header">
          <h4>
            <ListIcon />
            <span>{list.get('title')}</span>
          </h4>
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
                          rowClassName={this.getRowClass}
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
