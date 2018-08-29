import React from 'react';

import { untitledEntry } from 'config';
import { buildDate } from 'helpers/utils';

import { Collection } from 'components/icons';


export function PageIndex({ cellData, rowIndex }) {
  return <div className="row-index">{rowIndex + 1}</div>;
}


export function PageRenderer({ cellData, rowData }) {
  return (
    <div className="page-title" title={buildDate(rowData.get('timestamp'))}>
      <h2>{ cellData || untitledEntry }</h2>
      <span>{ rowData.get('url') }</span>
    </div>
  );
}

export function headerRenderer({ dataKey, label, sortBy, sortDirection, columnData: { count, activeBookmark } }) {
  return (
    <div
      className="ReactVirtualized__Table__headerTruncatedText"
      key="label"
      title={label}>
      <Collection />
      <span dangerouslySetInnerHTML={{ __html: ` ${label} (${activeBookmark + 1} <em>of</em> ${count})` }} />
    </div>
  );
}
