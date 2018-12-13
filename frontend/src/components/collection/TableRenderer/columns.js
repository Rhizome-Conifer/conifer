import React from 'react';
import { Link } from 'react-router-dom';
import defaultHeaderRenderer from 'react-virtualized/dist/commonjs/Table/defaultHeaderRenderer';
import { DropTarget, DragSource } from 'react-dnd';

import { draggableTypes, untitledEntry } from 'config';
import { capitalize, getCollectionLink, getListLink, remoteBrowserMod, stopPropagation } from 'helpers/utils';

import RemoveWidget from 'components/RemoveWidget';
import TimeFormat from 'components/TimeFormat';


export function BasicRenderer({ cellData }) {
  return <span>{cellData}</span>;
}


export function BrowserRenderer({ cellData, columnData: { browsers } }) {
  if (__PLAYER__ && typeof cellData !== 'undefined') {
    return (
      <span>{cellData}</span>
    );
  }

  if (!__PLAYER__ && typeof cellData !== 'undefined') {
    const browserObj = browsers.getIn(['browsers', cellData]);

    if (!browserObj) {
      return null;
    }

    const browserName = capitalize(browserObj.get('name'));
    const browserVrs = browserObj.get('version');
    return (
      <span>
        <img src={`/api/browsers/browsers/${cellData}/icon`} alt={`Recorded with ${browserName} version ${browserVrs}`} />
        { ` ${browserName} v${browserVrs}` }
      </span>
    );
  }
  return null;
}


export function LinkRenderer({ cellData, rowData, columnData: { collection, list } }) {
  const linkTo = list ?
    `${getListLink(collection, list)}/b${rowData.get('id')}/${remoteBrowserMod(rowData.get('browser'), rowData.get('timestamp'))}/${rowData.get('url')}` :
    `${getCollectionLink(collection)}/${remoteBrowserMod(rowData.get('browser'), rowData.get('timestamp'))}/${rowData.get('url')}`;
  return (
    <Link
      to={linkTo}
      onClick={evt => stopPropagation(evt)}
      title={rowData.get('title')}>
      {cellData || untitledEntry}
    </Link>
  );
}


export function RemoveRenderer({ rowData, columnData: { bkDeleting, bkDeleteError, listId, removeCallback } }) {
  const removeClick = () => removeCallback(listId, rowData.get('id'));
  return (
    <RemoveWidget
      error={bkDeleteError}
      isDeleting={bkDeleting}
      callback={removeClick}
      placement="right"
      scrollCheck=".ReactVirtualized__Grid" />
  );
}


export function RowIndexRenderer({ cellData, rowIndex }) {
  return <div className="row-index">{rowIndex + 1}</div>;
}


export function SessionRenderer({ cellData, columnData: { activeList, canAdmin, collLink }, rowData }) {
  const recording = activeList ? rowData.getIn(['page', 'rec']) : cellData;
  return canAdmin ?
    <Link to={`${collLink}/management?session=${recording}`} onClick={evt => stopPropagation(evt)} className="session-link">{recording}</Link> :
    <span>{recording}</span>;
}


export function TimestampRenderer({ cellData }) {
  return <TimeFormat dt={cellData} />;
}


export function TitleRenderer({ cellData, rowData, columnData: { collection, list } }) {
  const linkTo = list ?
    `${getListLink(collection, list)}/b${rowData.get('id')}/${remoteBrowserMod(rowData.get('browser'), rowData.get('timestamp'))}/${rowData.get('url')}` :
    `${getCollectionLink(collection)}/${remoteBrowserMod(rowData.get('browser'), rowData.get('timestamp'))}/${rowData.get('url')}`;
  return (
    <Link
      to={linkTo}
      onClick={evt => stopPropagation(evt)}
      title={rowData.get('title')}>{ cellData || untitledEntry }
    </Link>
  );
}

export function DefaultHeader(props) {
  return defaultHeaderRenderer(props);
}

const headerSource = {
  beginDrag({ dataKey, columnData: { index } }) {
    return {
      key: dataKey,
      idx: index,
      initialIdx: index
    };
  },
  isDragging(props, monitor) {
    return props.dataKey === monitor.getItem().key;
  }
};


const headerDropSource = {
  hover(props, monitor) {
    const origIndex = monitor.getItem().idx;
    const hoverIndex = props.columnData.index;

    // Don't replace items with themselves
    if (origIndex === hoverIndex) {
      return;
    }

    // Time to actually perform the action
    props.order(origIndex, hoverIndex);

    monitor.getItem().idx = hoverIndex;
  },
  drop(props, monitor) {
    if (props.save) {
      props.save();
    }
  }
};


function collect(connect, monitor) {
  return {
    connectDragSource: connect.dragSource(),
    connectDragPreview: connect.dragPreview(),
    isDragging: monitor.isDragging()
  };
}


function DnDSortableHeaderBuilder(props) {
  const { isDragging, connectDragPreview, connectDragSource, connectDropTarget, ...passThrough } = props;
  const dhr = defaultHeaderRenderer(passThrough);
  return connectDragPreview(
    <div style={{ opacity: isDragging ? 0 : 1 }}>
      {connectDragSource(connectDropTarget(<div className="header-handle" />))}
      {dhr}
    </div>
  );
}


export const DnDSortableHeader = DropTarget(
  draggableTypes.TH,
  headerDropSource,
  connect => ({
    connectDropTarget: connect.dropTarget(),
  })
)(DragSource(draggableTypes.TH, headerSource, collect)(DnDSortableHeaderBuilder));
