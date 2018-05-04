import React, { Component } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import ArrowKeyStepper from 'react-virtualized/dist/commonjs/ArrowKeyStepper';
import AutoSizer from 'react-virtualized/dist/commonjs/AutoSizer';
import Column from 'react-virtualized/dist/commonjs/Table/Column';
import Table from 'react-virtualized/dist/commonjs/Table';
import { List } from 'immutable';
import { Button } from 'react-bootstrap';

import config from 'config';

import { setSort } from 'redux/modules/collection';
import { getStorage, inStorage, setStorage, range } from 'helpers/utils';

import { CollectionFilters, CollectionHeader,
         InspectorPanel, Lists, ListHeader, Sidebar } from 'containers';

import HttpStatus from 'components/HttpStatus';
import Modal from 'components/Modal';
import Resizable from 'components/Resizable';

import 'react-virtualized/styles.css';

import { DefaultRow, DnDRow, DnDSortableRow } from './rows';
import { BrowserRenderer, DnDSortableHeader, LinkRenderer, RemoveRenderer, TimestampRenderer } from './columns';

import './style.scss';


class CollectionDetailUI extends Component {
  static contextTypes = {
    canAdmin: PropTypes.bool,
    isAnon: PropTypes.bool
  };

  static propTypes = {
    auth: PropTypes.object,
    browsers: PropTypes.object,
    clearInspector: PropTypes.func,
    clearQuery: PropTypes.func,
    collection: PropTypes.object,
    dispatch: PropTypes.func,
    list: PropTypes.object,
    match: PropTypes.object,
    pages: PropTypes.object,
    publicIndex: PropTypes.bool,
    removeBookmark: PropTypes.func,
    saveBookmarkSort: PropTypes.func,
    setMultiInspector: PropTypes.func,
    setBookmarkInspector: PropTypes.func,
    setPageInspector: PropTypes.func
  };

  constructor(props) {
    super(props);

    this.columns = config.columns;
    this.initialState = {
      columns: config.defaultColumns,
      headerEditor: false,
      listBookmarks: props.list.get('bookmarks'),
      overrideHeight: null,
      scrolled: false,
      selectedPageIdx: null
    };

    const activeList = Boolean(props.match.params.list);

    if (activeList) {
      this.initialState.columns = ['remove', ...this.initialState.columns];
    }

    this.state = this.initialState;
  }

  componentWillMount() {
    this.props.clearInspector();
  }

  componentDidMount() {
    if (inStorage('columnOrder')) {
      try {
        const columns = JSON.parse(getStorage('columnOrder'));

        if (!this.props.match.params.list && columns.includes('remove')) {
          columns.splice(columns.indexOf('remove'), 1);
        } else if (this.props.match.params.list && !columns.includes('remove')) {
          columns.unshift('remove');
        }

        this.setState({ columns });
      } catch (e) {
        console.log('Wrong `columnOrder` storage value.', e);
      }
    }
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.list !== this.props.list) {
      this.setState({ listBookmarks: nextProps.list.get('bookmarks') });
    }

    // clear querybox if removed from url
    if (this.props.location.search.includes('query') && !nextProps.location.search.includes('query')) {
      this.props.clearQuery();
    }
  }

  shouldComponentUpdate(nextProps) {
    // don't rerender for loading changes
    if (!nextProps.loaded) {
      return false;
    }

    return true;
  }

  onKeyNavigate = ({ scrollToRow }) => {
    const { match: { params: { list } }, pages, setBookmarkInspector, setPageInspector } = this.props;
    const { listBookmarks } = this.state;

    if (list) {
      setBookmarkInspector(listBookmarks.getIn([scrollToRow, 'id']));
    } else {
      setPageInspector(pages.getIn([scrollToRow, 'id']));
    }

    this.setState({ selectedPageIdx: scrollToRow });
  }

  onSelectRow = ({ event, index }) => {
    const { clearInspector, match: { params: { list } }, pages, setBookmarkInspector,
            setMultiInspector, setPageInspector } = this.props;
    const { listBookmarks, selectedPageIdx } = this.state;

    if (selectedPageIdx === index) {
      // clear selection
      this.setState({
        selectedPageIdx: null
      });

      // clear inspector
      clearInspector();
    } else {
      let selectedIndex;
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
        setMultiInspector(selectedIndex.length);
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
        setMultiInspector(selectedIndex.length);
      } else {
        selectedIndex = index;

        if (list) {
          setBookmarkInspector(listBookmarks.getIn([index, 'id']));
        } else {
          setPageInspector(pages.getIn([index, 'id']));
        }
      }

      this.setState({
        selectedPageIdx: selectedIndex
      });
    }
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

  testRowHighlight = ({ index }) => {
    const { selectedPageIdx } = this.state;
    const baseClass = index % 2 !== 0 ? 'odd' : '';

    if (!!selectedPageIdx && typeof selectedPageIdx === 'object') {
      return selectedPageIdx.includes(index) ? `${baseClass} selected` : baseClass;
    }
    return index === selectedPageIdx ? `${baseClass} selected` : baseClass;
  }

  sortBookmark = (origIndex, hoverIndex) => {
    const { listBookmarks } = this.state;
    const o = listBookmarks.get(origIndex);
    const sorted = listBookmarks.splice(origIndex, 1)
                                .splice(hoverIndex, 0, o);

    this.setState({ selectedPageIdx: null, listBookmarks: sorted });
  }

  orderColumn = (origIndex, hoverIndex) => {
    const { columns } = this.state;
    const c = columns.splice(origIndex, 1)[0];
    columns.splice(hoverIndex, 0, c);
    this.setState({ columns });
    this.saveHeaderState();
  }

  saveHeaderState = () => {
    setStorage('columnOrder', JSON.stringify(this.state.columns));
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

  toggleHeaderModal = () => {
    this.setState({ headerEditor: !this.state.headerEditor });
  }

  toggleColumn = (evt) => {
    const { columns } = this.state;
    const idx = columns.indexOf(evt.target.name);

    if (idx !== -1) {
      columns.splice(idx, 1);
    } else {
      columns.push(evt.target.name);
    }

    this.setState({ columns });
    this.saveHeaderState();
  }

  customRowRenderer = (props) => {
    const { canAdmin } = this.context;
    const { match: { params: { list } } } = this.props;

    if (!canAdmin) {
      return <DefaultRow {...props} />;
    }

    if (list) {
      return (
        <DnDSortableRow
          id={props.rowData.get('id')}
          save={this.saveSort}
          sort={this.sortBookmark}
          {...props} />
      );
    }
    return <DnDRow {...props} />;
  }

  customHeaderRenderer = (props) => {
    return (
      <DnDSortableHeader
        save={this.saveCollOrder}
        order={this.orderColumn}
        {...props} />
      );
  }

  collapsibleToggle = (isOpen) => {
    this.setState({ overrideHeight: isOpen ? null : 'auto' });
  }

  render() {
    const { canAdmin } = this.context;
    const { pages, browsers, collection, match: { params }, publicIndex } = this.props;
    const { listBookmarks, selectedPageIdx } = this.state;

    if (collection.get('error')) {
      return (
        <HttpStatus>
          <h2>Error</h2>
          <p>{collection.getIn(['error', 'error_message'])}</p>
        </HttpStatus>
      );
    }

    // don't render until loaded
    if (!collection.get('loaded')) {
      return null;
    }

    const activeList = Boolean(params.list);
    const activeListId = params.list;
    const indexPages = !canAdmin && !publicIndex ? List() : pages;
    const objects = activeList ? listBookmarks : indexPages;
    const objectLabel = activeList ? 'Bookmark Title' : 'Page Title';

    const columnDefs = {
      browser: {
        width: 150,
        dataKey: 'browser',
        key: 'browser',
        columnData: { browsers },
        cellRenderer: BrowserRenderer,
      },
      remove: {
        width: 40,
        dataKey: 'remove',
        key: 'remove',
        style: { textAlign: 'center' },
        columnData: {
          listId: activeListId,
          removeCallback: this.props.removeBookmark
        },
        cellRenderer: RemoveRenderer
      },
      session: {
        dataKey: 'rec',
        key: 'session',
        width: 100
      },
      timestamp: {
        width: 200,
        dataKey: 'timestamp',
        key: 'timestamp',
        cellRenderer: TimestampRenderer
      },
      title: {
        className: 'page-title',
        dataKey: 'title',
        flexGrow: 1,
        key: 'title',
        label: objectLabel,
        width: 200,
      },
      url: {
        width: 200,
        dataKey: 'url',
        key: 'url',
        flexGrow: 1,
        columnData: {
          collection,
          listId: activeListId
        },
        cellRenderer: LinkRenderer
      }
    };

    return (
      <div className={classNames('wr-coll-detail', { 'with-list': activeList })}>

        {
          activeList ?
            <ListHeader /> :
            <CollectionHeader condensed={this.state.scrolled} />
        }

        <Sidebar storageKey="collSidebar">
          <Resizable
            axis="y"
            minHeight={200}
            storageKey="collNavigator"
            overrideHeight={this.state.overrideHeight}>
            <Lists
              activeListId={activeListId}
              collapsibleToggle={this.collapsibleToggle} />
          </Resizable>
          <InspectorPanel />
        </Sidebar>

        {
          !activeList &&
            <CollectionFilters
              pages={pages}
              selectedPageIdx={selectedPageIdx} />
        }

        <div className="wr-coll-detail-table">
          {
            this.context.canAdmin &&
              <React.Fragment>
                <Button onClick={this.toggleHeaderModal} className="table-header-menu borderless" bsSize="xs">
                  {/* TODO: placeholder icon */}
                  <span style={{ display: 'inline-block', fontWeight: 'bold', transform: 'rotateZ(90deg)' }}>...</span>
                </Button>
                <Modal
                  visible={this.state.headerEditor}
                  closeCb={this.toggleHeaderModal}
                  dialogClassName="table-header-modal"
                  header={<h4>Edit Table Columns</h4>}
                  footer={<Button onClick={this.toggleHeaderModal}>Close</Button>}>
                  <ul>
                    {
                      this.columns.map((coll) => {
                        return (
                          <li key={coll}>
                            <input type="checkbox" onChange={this.toggleColumn} name={coll} id={`add-to-list-${coll}`} checked={this.state.columns.includes(coll) || false} />
                            <label htmlFor={`add-to-list-${coll}`}>{config.columnLabels[coll] || coll}</label>
                          </li>
                        );
                      })
                    }
                  </ul>
                </Modal>
              </React.Fragment>
          }
          <AutoSizer>
            {
              ({ height, width }) => (
                <ArrowKeyStepper
                  rowCount={pages.size}
                  columnCount={1}
                  mode="cells"
                  scrollToRow={selectedPageIdx || 0}
                  onScrollToChange={this.onKeyNavigate}>
                  {
                    ({ onSectionRendered, scrollToRow }) => {
                      return (
                        <Table
                          width={width}
                          height={height}
                          rowCount={objects ? objects.size : 0}
                          headerHeight={25}
                          rowHeight={40}
                          rowGetter={({ index }) => objects.get(index)}
                          rowClassName={this.testRowHighlight}
                          onRowClick={this.onSelectRow}
                          onRowsRendered={({ startIndex, stopIndex }) => {
                            onSectionRendered({ rowStartIndex: startIndex, rowStopIndex: stopIndex })
                          }}
                          onScroll={this.scrollHandler}
                          rowRenderer={this.customRowRenderer}
                          sort={activeList ? null : this.sort}
                          sortBy={activeList ? '' : collection.getIn(['sortBy', 'sort'])}
                          sortDirection={activeList ? null : collection.getIn(['sortBy', 'dir'])}>
                          {
                            this.state.columns.map((c, idx) => {
                              let props = columnDefs[c];
                              let collData = {};

                              if (props.hasOwnProperty('columnData')) {
                                props = Object.assign({}, props);
                                collData = props.columnData;
                                delete props.columnData;
                              }

                              if (!props.label) {
                                props.label = config.columnLabels[[c]] || c;
                              }

                              return (
                                <Column
                                  headerRenderer={this.customHeaderRenderer}
                                  index={idx}
                                  columnData={{ ...collData, index: idx }}
                                  {...props} />
                              );
                            })
                          }
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

export default CollectionDetailUI;
