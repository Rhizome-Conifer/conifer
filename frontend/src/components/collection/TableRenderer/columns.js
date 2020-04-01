import React from 'react';
import { Link } from 'react-router-dom';
// import defaultHeaderRenderer from 'react-virtualized/dist/commonjs/Table/defaultHeaderRenderer';
import SortDirection from 'react-virtualized/dist/commonjs/Table/SortDirection';
import classNames from 'classnames';
import { DropTarget, DragSource } from 'react-dnd';

import { draggableTypes, untitledEntry } from 'config';
import { capitalize, getCollectionLink, getListLink, remoteBrowserMod, stopPropagation } from 'helpers/utils';

import RemoveWidget from 'components/RemoveWidget';
import TimeFormat from 'components/TimeFormat';


function SortIndicator({sortDirection}) {
  const classes = classNames('ReactVirtualized__Table__sortableHeaderIcon', {
    'ReactVirtualized__Table__sortableHeaderIcon--ASC':
      sortDirection === SortDirection.ASC,
    'ReactVirtualized__Table__sortableHeaderIcon--DESC':
      sortDirection === SortDirection.DESC,
  });

  return (
    <svg className={classes} width={12} height={13} viewBox="0 0 12 13">
      {sortDirection === SortDirection.ASC ? (
        <path d="M2.57143164,11.7142878 C2.62500313,11.7142878 2.67857462,11.6941984 2.72544968,11.6540198 L4.86161294,9.51785657 C4.90179156,9.47098151 4.9285773,9.41741002 4.9285773,9.35714209 C4.9285773,9.23660623 4.83482719,9.14285612 4.71429133,9.14285612 L3.42857552,9.14285612 L3.42857552,-0.0714405775 C3.42857552,-0.191976435 3.3348254,-0.285726547 3.21428955,-0.285726547 L1.92857373,-0.285726547 C1.80803787,-0.285726547 1.71428776,-0.191976435 1.71428776,-0.0714405775 L1.71428776,9.14285612 L0.428571939,9.14285612 C0.341518264,9.14285612 0.261161026,9.19642761 0.227678843,9.27678485 C0.19419666,9.35714209 0.21428597,9.44419577 0.274553899,9.51116013 L2.4174136,11.6540198 C2.46428865,11.6941984 2.51786014,11.7142878 2.57143164,11.7142878 Z M7.92858088,1.42856121 C8.04911674,1.42856121 8.14286685,1.3348111 8.14286685,1.21427345 L8.14286685,-0.0714405775 C8.14286685,-0.191976435 8.04911674,-0.285726547 7.92858088,-0.285726547 L6.21429312,-0.285726547 C6.09375726,-0.285726547 6.00000715,-0.191976435 6.00000715,-0.0714405775 L6.00000715,1.21427345 C6.00000715,1.3348111 6.09375726,1.42856121 6.21429312,1.42856121 L7.92858088,1.42856121 Z M9.2142967,4.85713673 C9.33483256,4.85713673 9.42858267,4.76338661 9.42858267,4.64284897 L9.42858267,3.35713494 C9.42858267,3.23659908 9.33483256,3.14284897 9.2142967,3.14284897 L6.21429312,3.14284897 C6.09375726,3.14284897 6.00000715,3.23659908 6.00000715,3.35713494 L6.00000715,4.64284897 C6.00000715,4.76338661 6.09375726,4.85713673 6.21429312,4.85713673 L9.2142967,4.85713673 Z M10.5000072,8.28571224 C10.6205484,8.28571224 10.7142985,8.19196213 10.7142985,8.07142448 L10.7142985,6.78571045 C10.7142985,6.6651746 10.6205484,6.57142448 10.5000072,6.57142448 L6.21429312,6.57142448 C6.09375726,6.57142448 6.00000715,6.6651746 6.00000715,6.78571045 L6.00000715,8.07142448 C6.00000715,8.19196213 6.09375726,8.28571224 6.21429312,8.28571224 L10.5000072,8.28571224 Z M11.7857283,11.7142878 C11.9062642,11.7142878 12.0000072,11.6205376 12.0000072,11.5 L12.0000072,10.214286 C12.0000072,10.0937501 11.9062642,10 11.7857283,10 L6.21429312,10 C6.09375726,10 6.00000715,10.0937501 6.00000715,10.214286 L6.00000715,11.5 C6.00000715,11.6205376 6.09375726,11.7142878 6.21429312,11.7142878 L11.7857283,11.7142878 Z" />
      ) : (
        <path d="M2.57143164,11.7142878 C2.62500313,11.7142878 2.67857462,11.6941984 2.72544968,11.6540198 L4.86161294,9.51785657 C4.90179156,9.47098151 4.9285773,9.41741002 4.9285773,9.35714209 C4.9285773,9.23660623 4.83482719,9.14285612 4.71429133,9.14285612 L3.42857552,9.14285612 L3.42857552,-0.0714405775 C3.42857552,-0.191976435 3.3348254,-0.285726547 3.21428955,-0.285726547 L1.92857373,-0.285726547 C1.80803787,-0.285726547 1.71428776,-0.191976435 1.71428776,-0.0714405775 L1.71428776,9.14285612 L0.428571939,9.14285612 C0.341518264,9.14285612 0.261161026,9.19642761 0.227678843,9.27678485 C0.19419666,9.35714209 0.21428597,9.44419577 0.274553899,9.51116013 L2.4174136,11.6540198 C2.46428865,11.6941984 2.51786014,11.7142878 2.57143164,11.7142878 Z M11.7857283,1.42856121 C11.9062642,1.42856121 12.0000072,1.3348111 12.0000072,1.21427345 L12.0000072,-0.0714405775 C12.0000072,-0.191976435 11.9062642,-0.285726547 11.7857283,-0.285726547 L6.21429312,-0.285726547 C6.09375726,-0.285726547 6.00000715,-0.191976435 6.00000715,-0.0714405775 L6.00000715,1.21427345 C6.00000715,1.3348111 6.09375726,1.42856121 6.21429312,1.42856121 L11.7857283,1.42856121 Z M10.5000072,4.85713673 C10.6205484,4.85713673 10.7142985,4.76338661 10.7142985,4.64284897 L10.7142985,3.35713494 C10.7142985,3.23659908 10.6205484,3.14284897 10.5000072,3.14284897 L6.21429312,3.14284897 C6.09375726,3.14284897 6.00000715,3.23659908 6.00000715,3.35713494 L6.00000715,4.64284897 C6.00000715,4.76338661 6.09375726,4.85713673 6.21429312,4.85713673 L10.5000072,4.85713673 Z M9.2142967,8.28571224 C9.33483256,8.28571224 9.42858267,8.19196213 9.42858267,8.07142448 L9.42858267,6.78571045 C9.42858267,6.6651746 9.33483256,6.57142448 9.2142967,6.57142448 L6.21429312,6.57142448 C6.09375726,6.57142448 6.00000715,6.6651746 6.00000715,6.78571045 L6.00000715,8.07142448 C6.00000715,8.19196213 6.09375726,8.28571224 6.21429312,8.28571224 L9.2142967,8.28571224 Z M7.92858088,11.7142878 C8.04911674,11.7142878 8.14286685,11.6205376 8.14286685,11.5 L8.14286685,10.214286 C8.14286685,10.0937501 8.04911674,10 7.92858088,10 L6.21429312,10 C6.09375726,10 6.00000715,10.0937501 6.00000715,10.214286 L6.00000715,11.5 C6.00000715,11.6205376 6.09375726,11.7142878 6.21429312,11.7142878 L7.92858088,11.7142878 Z" />
      )}
    </svg>
  );
}


function customHeaderRenderer({ dataKey, label, sortBy, sortDirection }) {
  const showSortIndicator = sortBy === dataKey;
  const children = [
    <span
      className="ReactVirtualized__Table__headerTruncatedText"
      key="label"
      title={typeof label === 'string' ? label : null}>
      {label}
    </span>,
  ];

  if (showSortIndicator) {
    children.push(
      <SortIndicator key="SortIndicator" sortDirection={sortDirection} />,
    );
  } else {
    children.push(
      <svg width="6px" height="12px" viewBox="0 0 6 12">
        <path d="M5.35714924,5.99998748 C5.55246198,5.99998748 5.71429253,5.77343008 5.71429253,5.49998748 C5.71429253,5.36717959 5.67522998,5.24217944 5.60826561,5.14842933 L3.10826263,1.64842516 C3.04129827,1.55467505 2.95201245,1.49998748 2.85714626,1.49998748 C2.76228008,1.49998748 2.67299426,1.55467505 2.60602989,1.64842516 L0.106026912,5.14842933 C0.0390625466,5.24217944 0,5.36717959 0,5.49998748 C0,5.77343008 0.16183055,5.99998748 0.357143283,5.99998748 L5.35714924,5.99998748 Z M2.85714626,12.4999952 C2.95201245,12.4999952 3.04129827,12.445313 3.10826263,12.3515629 L5.60826561,8.85155875 C5.67522998,8.75780864 5.71429253,8.63280849 5.71429253,8.49999523 C5.71429253,8.226558 5.55246198,7.99999523 5.35714924,7.99999523 L0.357143283,7.99999523 C0.16183055,7.99999523 0,8.226558 0,8.49999523 C0,8.63280849 0.0390625466,8.75780864 0.106026912,8.85155875 L2.60602989,12.3515629 C2.67299426,12.445313 2.76228008,12.4999952 2.85714626,12.4999952 Z" fill="#4A4A4A" />
      </svg>
    )
  }

  return children;
}


export function BasicRenderer({ cellData }) {
  return <span>{cellData}</span>;
}


export function BrowserRenderer({ cellData, columnData: { browsers } }) {
  if (__DESKTOP__ && typeof cellData !== 'undefined') {
    return (
      <span>{cellData}</span>
    );
  }

  if (!__DESKTOP__ && typeof cellData !== 'undefined') {
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
      callback={removeClick}
      deleteMsg="Remove from list?"
      error={bkDeleteError}
      isDeleting={bkDeleting}
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
  return <div key={props.label} style={{ paddingLeft: '1rem' }}>{customHeaderRenderer(props)}</div>
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
  const dhr = customHeaderRenderer(passThrough);
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
