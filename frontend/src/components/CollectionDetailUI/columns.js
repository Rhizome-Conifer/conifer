import React from 'react';
import { Link } from 'react-router';

import { untitledEntry } from 'config';

import EditableString from 'components/EditableString';
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

export function LinkRenderer({ cellData, rowData, columnData: { collection } }) {
  return (
    <Link
      to={`/${collection.get('user')}/${collection.get('id')}/${remoteBrowserMod(rowData.get('browser'), rowData.get('timestamp'))}/${rowData.get('url')}`}
      title={rowData.get('title')}>
      <EditableString
        string={cellData || untitledEntry}
        className="edit-coll-title" />
    </Link>
  );
}

export function TimestampRenderer({ cellData }) {
  return <TimeFormat dt={cellData} />;
}
