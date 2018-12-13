import React, { Component } from 'react';
import PropTypes from 'prop-types';
import memoize from 'memoize-one';
import ArrowKeyStepper from 'react-virtualized/dist/commonjs/ArrowKeyStepper';
import AutoSizer from 'react-virtualized/dist/commonjs/AutoSizer';
import Column from 'react-virtualized/dist/commonjs/Table/Column';
import Table from 'react-virtualized/dist/commonjs/Table';
import { Button } from 'react-bootstrap';

import config from 'config';
import { getCollectionLink, getStorage, inStorage, setStorage } from 'helpers/utils';

import { CollectionFilters, ListHeader } from 'containers';

import Modal from 'components/Modal';
import OutsideClick from 'components/OutsideClick';

import {
  BrowserRenderer,
  DefaultHeader,
  DnDSortableHeader,
  LinkRenderer,
  RemoveRenderer,
  RowIndexRenderer,
  SessionRenderer,
  TitleRenderer,
  TimestampRenderer
} from './columns';
import { DefaultRow, DnDRow, DnDSortableRow } from './rows';
import './style.scss';


class TableRenderer extends Component {
  static contextTypes = {
    canAdmin: PropTypes.bool,
    isMobile: PropTypes.bool
  };

  static propTypes = {
    activeList: PropTypes.bool,
    browsers: PropTypes.object,
    collection: PropTypes.object.isRequired,
    deselect: PropTypes.func,
    displayObjects: PropTypes.object,
    list: PropTypes.object,
    onKeyNavigate: PropTypes.func,
    onSelectRow: PropTypes.func,
    saveSort: PropTypes.func,
    selectedPageIdx: PropTypes.number,
    sort: PropTypes.func,
    sortBookmark: PropTypes.func
  };

  constructor(props, context) {
    super(props);

    this.columns = config.columns;
    this.state = {
      columns: context.isMobile ? ['timestamp', 'url'] : config.defaultColumns,
      headerEditor: false
    };

    if (props.activeList && context.canAdmin && !context.isMobile) {
      this.state.columns = ['remove', ...this.columns];
    }
  }

  componentDidMount() {
    const { canAdmin, isMobile } = this.context;
    const { activeList } = this.props;

    if (isMobile) {
      return false;
    }

    if (inStorage('columnOrder')) {
      try {
        const columns = JSON.parse(getStorage('columnOrder')).filter(o => config.columns.includes(o));

        if ((!activeList || !canAdmin) && columns.includes('remove')) {
          columns.splice(columns.indexOf('remove'), 1);
        } else if (activeList && canAdmin && !columns.includes('remove')) {
          columns.unshift('remove');
        }

        this.setState({ columns });
      } catch (e) {
        console.log('Wrong `columnOrder` storage value.', e);
      }
    }
  }

  getColumnDefs = memoize((activeList, collection, browsers, list, objectLabel) => {
    const { canAdmin } = this.context;
    return {
      browser: {
        cellRenderer: BrowserRenderer,
        columnData: { browsers },
        dataKey: 'browser',
        key: 'browser',
        width: 150
      },
      rowIndex: {
        cellRenderer: RowIndexRenderer,
        dataKey: 'id',
        disableSort: true,
        key: 'rowIndex',
        width: 60
      },
      remove: {
        cellRenderer: RemoveRenderer,
        columnData: {
          bkDeleting: this.props.bkDeleting,
          bkDeleteError: this.props.bkDeleteError,
          listId: activeList ? list.get('id') : null,
          removeCallback: this.props.removeBookmark
        },
        dataKey: 'remove',
        key: 'remove',
        width: 55
      },
      session: {
        cellRenderer: SessionRenderer,
        columnData: {
          activeList,
          canAdmin,
          collLink: getCollectionLink(collection)
        },
        dataKey: 'rec',
        key: 'session',
        width: 100
      },
      timestamp: {
        cellRenderer: TimestampRenderer,
        dataKey: 'timestamp',
        key: 'timestamp',
        width: 200
      },
      title: {
        cellRenderer: TitleRenderer,
        className: 'page-title',
        columnData: {
          collection,
          list: activeList ? list : null
        },
        dataKey: 'title',
        flexGrow: 1,
        key: 'title',
        label: objectLabel,
        width: 200
      },
      url: {
        cellRenderer: LinkRenderer,
        columnData: {
          collection,
          list: activeList ? list : null
        },
        dataKey: 'url',
        flexGrow: 1,
        key: 'url',
        width: 200
      }
    };
  })

  customRowRenderer = (props) => {
    const { canAdmin } = this.context;
    const { activeList } = this.props;

    if (!canAdmin || __PLAYER__) {
      return <DefaultRow {...props} />;
    }

    if (activeList) {
      return (
        <DnDSortableRow
          id={props.rowData.get('id')}
          save={this.props.saveSort}
          sort={this.props.sortBookmark}
          pageSelection={this.state.selectedPageIdx}
          {...props} />
      );
    }
    return <DnDRow {...props} />;
  }

  customHeaderRenderer = (props) => {
    if (__PLAYER__) {
      return <DefaultHeader {...props} />;
    }

    return (
      <DnDSortableHeader
        order={this.orderColumn}
        {...props} />
    );
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

  testRowHighlight = ({ index }) => {
    const { selectedPageIdx } = this.props;
    const baseClass = index % 2 !== 0 ? 'odd' : '';

    if (!!selectedPageIdx && typeof selectedPageIdx === 'object') {
      return selectedPageIdx.includes(index) ? `${baseClass} selected` : baseClass;
    }
    return index === selectedPageIdx ? `${baseClass} selected` : baseClass;
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

  toggleHeaderModal = () => {
    this.setState({ headerEditor: !this.state.headerEditor });
  }

  render() {
    const { canAdmin } = this.context;
    const { activeList, browsers, collection, displayObjects, list, selectedPageIdx } = this.props;

    const objectLabel = activeList ? 'Bookmark Title' : 'Page Title';
    const columnDefs = this.getColumnDefs(activeList, collection, browsers, list, objectLabel);

    return (
      <div className="table-container">
        {
          activeList ?
            <ListHeader /> :
            <div className="collection-header">
              <h2>Pages</h2>
              <CollectionFilters />
            </div>
        }

        <OutsideClick classes="wr-coll-detail-table" handleClick={this.props.deselect}>
          {
            canAdmin &&
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
                  rowCount={displayObjects.size}
                  columnCount={1}
                  mode="cells"
                  scrollToRow={typeof selectedPageIdx === 'number' ? selectedPageIdx : 0}
                  onScrollToChange={this.props.onKeyNavigate}>
                  {
                    ({ onSectionRendered, scrollToRow }) => {
                      return (
                        <Table
                          width={width}
                          height={height}
                          rowCount={displayObjects.size}
                          headerHeight={25}
                          rowHeight={40}
                          rowGetter={({ index }) => displayObjects.get(index)}
                          rowClassName={this.testRowHighlight}
                          onRowClick={this.props.onSelectRow}
                          onRowsRendered={({ startIndex, stopIndex }) => {
                            onSectionRendered({ rowStartIndex: startIndex, rowStopIndex: stopIndex })
                          }}
                          rowRenderer={this.customRowRenderer}
                          sort={activeList ? null : this.props.sort}
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
        </OutsideClick>
      </div>
    );
  }
}

export default TableRenderer;
