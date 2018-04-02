import React, { Component } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import AutoSizer from 'react-virtualized/dist/commonjs/AutoSizer';
import Column from 'react-virtualized/dist/commonjs/Table/Column';
import Table from 'react-virtualized/dist/commonjs/Table';
import { Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import config from 'config';

import { setSort } from 'redux/modules/collection';
import { getStorage, inStorage, setStorage, range } from 'helpers/utils';

import { CollectionFilters, CollectionHeader } from 'containers';

import Modal from 'components/Modal';
import { CloseIcon } from 'components/icons';

import 'react-virtualized/styles.css';

import CollectionSidebar from './sidebar';
import { DefaultRow, DnDRow, DnDSortableRow } from './rows';
import { BrowserRenderer, DnDSortableHeader, LinkRenderer, RemoveRenderer, TimestampRenderer } from './columns';

import './style.scss';


class CollectionDetailUI extends Component {
  static propTypes = {
    auth: PropTypes.object,
    browsers: PropTypes.object,
    collection: PropTypes.object,
    dispatch: PropTypes.func,
    list: PropTypes.object,
    match: PropTypes.object,
    pages: PropTypes.object,
    removeBookmark: PropTypes.func,
    saveBookmarkSort: PropTypes.func
  };

  static contextTypes = {
    canAdmin: PropTypes.bool,
    isAnon: PropTypes.bool
  }

  constructor(props) {
    super(props);

    this.columns = config.columns;
    this.initialState = {
      columns: config.defaultColumns,
      headerEditor: false,
      listBookmarks: props.list.get('bookmarks'),
      scrolled: false,
      selectedPageIdx: null
    };

    const activeList = Boolean(props.match.params.list);

    if (activeList) {
      this.initialState.columns = ['remove', ...this.initialState.columns];
    }

    this.state = this.initialState;
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
  }

  shouldComponentUpdate(nextProps) {
    // don't rerender for loading changes
    if (!nextProps.loaded) {
      return false;
    }

    return true;
  }

  onSelectRow = ({ event, index }) => {
    const { selectedPageIdx } = this.state;

    if (selectedPageIdx === index) {
      // clear selection
      this.setState({
        selectedPageIdx: null
      });
    } else {
      let selectedIndex = index;
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

    if (!!selectedPageIdx && typeof selectedPageIdx === 'object') {
      return selectedPageIdx.includes(index) ? 'selected' : '';
    }
    return index === selectedPageIdx ? 'selected' : '';
  }

  sortBookmark = (origIndex, hoverIndex) => {
    const { listBookmarks } = this.state;
    const o = listBookmarks.get(origIndex);
    const sorted = listBookmarks.splice(origIndex, 1)
                                .splice(hoverIndex, 0, o);

    this.setState({ listBookmarks: sorted });
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

  render() {
    const { pages, browsers, collection, match: { params } } = this.props;
    const { listBookmarks, selectedPageIdx } = this.state;

    // don't render until loaded
    if (!collection.get('loaded')) {
      return null;
    }

    const activeList = Boolean(params.list);
    const objects = activeList ? listBookmarks : pages;
    const objectLabel = activeList ? 'Bookmark' : 'Page';

    const columnDefs = {
      browser: {
        width: 150,
        label: 'remote browser',
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
          listId: params.list,
          removeCallback: this.props.removeBookmark
        },
        cellRenderer: RemoveRenderer
      },
      session: {
        label: 'session',
        dataKey: 'recording',
        key: 'session',
        width: 100
      },
      timestamp: {
        width: 200,
        label: 'timestamp',
        dataKey: 'timestamp',
        key: 'timestamp',
        cellRenderer: TimestampRenderer
      },
      title: {
        width: 200,
        label: objectLabel,
        dataKey: 'title',
        key: 'title',
        flexGrow: 1,
        columnData: {
          collection,
          listId: params.list
        },
        cellRenderer: LinkRenderer,
      },
      url: {
        width: 200,
        label: 'url',
        dataKey: 'url',
        key: 'url',
        flexGrow: 1
      }
    };

    return (
      <div className="wr-coll-detail">
        <CollectionHeader
          activeList={activeList}
          condensed={this.state.scrolled} />

        <div className="grid-wrapper">
          <div className={classNames('wr-coll-container', { 'with-lists': activeList })}>

            <CollectionSidebar collection={collection} activeListId={params.list} />

            {
              activeList ?
                <div className="lists-modifier">
                  <header className="lists-header">
                    <span>Bookmarks in Selected List</span>
                    <Link to={`/${collection.get('user')}/${collection.get('id')}`}>Back to Collection Index <CloseIcon /></Link>
                  </header>
                </div> :
                <CollectionFilters
                  pages={pages}
                  selectedPageIdx={selectedPageIdx} />
            }

            <div className={classNames('wr-coll-detail-table', { 'with-lists': activeList })}>
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
                                <label htmlFor={`add-to-list-${coll}`}>{coll}</label>
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
                    <Table
                      width={
                        /* factor border width */
                        activeList ? width - 8 : width
                      }
                      height={height}
                      rowCount={objects ? objects.size : 0}
                      headerHeight={50}
                      rowHeight={40}
                      rowGetter={({ index }) => objects.get(index)}
                      rowClassName={this.testRowHighlight}
                      onRowClick={this.onSelectRow}
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
                  )
                }
              </AutoSizer>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default CollectionDetailUI;
