import React from 'react';
import { defaultTableRowRenderer} from 'react-virtualized';
import { DragSource } from 'react-dnd';
import { draggableTypes } from 'config';


const pageSource = {
  beginDrag({ rowData }) {
    return rowData.toJS();
  }
};

function collect(connect, monitor) {
  return {
    connectDragSource: connect.dragSource(),
    isDragging: monitor.isDragging()
  };
}

function DnDRow(props) {
  const { isDragging, connectDragSource, ...passThrough } = props;
  return props.connectDragSource(defaultTableRowRenderer(passThrough));
}

export default DragSource(draggableTypes.PAGE_ITEM, pageSource, collect)(DnDRow);
