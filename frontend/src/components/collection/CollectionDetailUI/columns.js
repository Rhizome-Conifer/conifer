import React from 'react';
import { Link } from 'react-router-dom';
import defaultHeaderRenderer from 'react-virtualized/dist/commonjs/Table/defaultHeaderRenderer';
import { DropTarget, DragSource } from 'react-dnd';

import { draggableTypes, untitledEntry } from 'config';

import RemoveWidget from 'components/RemoveWidget';
import TimeFormat from 'components/TimeFormat';
import { capitalize, remoteBrowserMod } from 'helpers/utils';


export function BrowserRenderer({ cellData, columnData: { browsers } }) {
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

export function LinkRenderer({ cellData, rowData, columnData: { collection, listId } }) {
  const linkTo = listId ?
    `/${collection.get('user')}/${collection.get('id')}/list/${listId}-${rowData.get('id')}/${remoteBrowserMod(rowData.get('browser'), rowData.get('timestamp'))}/${rowData.get('url')}` :
    `/${collection.get('user')}/${collection.get('id')}/${remoteBrowserMod(rowData.get('browser'), rowData.get('timestamp'))}/${rowData.get('url')}`;
  return (
    <Link
      to={linkTo}
      title={rowData.get('title')}>
      {cellData || untitledEntry}
    </Link>
  );
}


export function RemoveRenderer({ rowData, columnData: { listId, removeCallback } }) {
  const removeClick = () => removeCallback(listId, rowData.get('id'));
  return <RemoveWidget callback={removeClick} withConfirmation={false} />;
}


export function TimestampRenderer({ cellData }) {
  return <TimeFormat dt={cellData} />;
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
    isDragging: monitor.isDragging()
  };
}

function DnDSortableHeaderBuilder(props) {
  const { isDragging, connectDragSource, connectDropTarget, ...passThrough } = props;
  const dhr = defaultHeaderRenderer(passThrough);
  return connectDragSource(connectDropTarget(<div style={{ opacity: isDragging ? 0 : 1 }}>{dhr}</div>));
}

export const DnDSortableHeader = DropTarget(
  draggableTypes.TH,
  headerDropSource,
  connect => ({
    connectDropTarget: connect.dropTarget(),
  })
)(DragSource(draggableTypes.TH, headerSource, collect)(DnDSortableHeaderBuilder));
