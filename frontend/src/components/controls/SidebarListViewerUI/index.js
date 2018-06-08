import React, { Component } from 'react';
import PropTypes from 'prop-types';
import AutoSizer from 'react-virtualized/dist/commonjs/AutoSizer';
import ArrowKeyStepper from 'react-virtualized/dist/commonjs/ArrowKeyStepper';
import Column from 'react-virtualized/dist/commonjs/Table/Column';
import Table from 'react-virtualized/dist/commonjs/Table';
import classNames from 'classnames';
import { Link } from 'react-router-dom';
import { batchActions } from 'redux-batched-actions';

import { defaultListDesc, untitledEntry } from 'config';
import { getListLink, remoteBrowserMod } from 'helpers/utils';

import { setBookmarkId, updateUrlAndTimestamp } from 'store/modules/controls';
import { setBrowser } from 'store/modules/remoteBrowsers';

import InlineEditor from 'components/InlineEditor';
import SidebarHeader from 'components/SidebarHeader';
import Truncate from 'components/Truncate';
import WYSIWYG from 'components/WYSIWYG';
import { CatalogIcon, ListIcon } from 'components/icons';

import { BookmarkRenderer, PageIndex } from './renderers';
import './style.scss';


class SidebarListViewer extends Component {
  static contextTypes = {
    canAdmin: PropTypes.bool,
    router: PropTypes.object,
  }

  static propTypes = {
    activeBookmark: PropTypes.number,
    bookmarks: PropTypes.object,
    clearInspector: PropTypes.func,
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

  componentWillUnmount() {
    this.props.clearInspector();
  }

  onKeyNavigate = ({ scrollToRow }) => {
    const { bookmarks } = this.props;
    const page = bookmarks.get(scrollToRow);

    // TODO: race condition when keying quickly, old iframe change updates and makes current deselected
    this.setState({ navigated: false });
    this.props.dispatch(batchActions([
      updateUrlAndTimestamp(page.get('url'), page.get('timestamp'), page.get('title') || untitledEntry, false),
      setBrowser(page.get('browser') || null),
      setBookmarkId(page.get('id'))
    ]));

    // TODO: should we use router to add history changes?
    // const tsMod = remoteBrowserMod(page.get('browser'), page.get('timestamp'), '/');
    // this.context.router.history.push(`${getListLink(collection, list)}/b${page.get('id')}/${tsMod}${page.get('url')}`);
  }

  onSelectRow = ({ index, rowData }) => {
    const { bookmarks } = this.props;
    const page = bookmarks.get(index);
    this.setState({ navigated: false });
    //const tsMod = remoteBrowserMod(rowData.get('browser'), rowData.get('timestamp'), '/');
    //this.context.router.history.push(`${getListLink(collection, list)}/b${rowData.get('id')}/${tsMod}${rowData.get('url')}`);

    this.props.dispatch(batchActions([
      updateUrlAndTimestamp(page.get('url'), page.get('timestamp'), page.get('title') || untitledEntry, false),
      setBrowser(page.get('browser') || null),
      setBookmarkId(page.get('id'))
    ]));
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
    this.props.editList(collection.get('owner'), collection.get('id'), list.get('id'), { title });
  }

  editListDesc = (desc) => {
    const { collection, list } = this.props;
    this.props.editList(collection.get('owner'), collection.get('id'), list.get('id'), { desc });
  }

  returnToCollection = () => this.props.showNavigator(true)

  render() {
    const { activeBookmark, bookmarks, collection, list, listEdited } = this.props;

    return (
      <div className="bookmark-list">
        <SidebarHeader label="Collection Navigator" />
        <nav>
          <button onClick={this.returnToCollection} className="borderless">&larr; all lists</button>
          <Link to={getListLink(collection, list)}>Collection Index <CatalogIcon /></Link>
        </nav>
        <header className="list-header">
          <h4>
            <ListIcon />
            <InlineEditor
              blockDisplay
              canAdmin={this.context.canAdmin}
              initial={list.get('title')}
              onSave={this.editListTitle}
              success={listEdited}>
              <span>{list.get('title')}</span>
            </InlineEditor>
          </h4>
          <Truncate height={75} className="description" propPass="clickToEdit">
            <WYSIWYG
              key={list.get('id')}
              initial={list.get('desc')}
              onSave={this.editListDesc}
              placeholder={defaultListDesc}
              success={listEdited} />
          </Truncate>
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
                            label="row index"
                            dataKey="id"
                            flexShrink={1}
                            width={25}
                            className="row-index-container"
                            cellRenderer={PageIndex} />
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
