import React from 'react';
import { Link } from 'react-router';

import EditableString from 'components/EditableString';
import TimeFormat from 'components/TimeFormat';
import { capitalize, remoteBrowserMod } from 'helpers/utils';


export function BrowserRenderer({ cellData, columnData: { browsers } }) {
  if (typeof cellData !== 'undefined') {
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

export function LinkRenderer({ cellData, rowData, columnData: { collection } }) {
  return (
    <Link to={`/${collection.get('user')}/${collection.get('id')}/${remoteBrowserMod(rowData.get('browser'), rowData.get('timestamp'))}/${rowData.get('url')}`}>
      <EditableString
        string={cellData || 'Untitled document'}
        className="edit-coll-title" />
    </Link>
  );
}

export function TagRenderer({ cellData }) {
  return [
    <span key="a">#page</span>
  ];
}

export function TimestampRenderer({ cellData }) {
  return <TimeFormat dt={cellData} />;
}
