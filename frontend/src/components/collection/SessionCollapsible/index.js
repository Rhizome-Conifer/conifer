import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import AutoSizer from 'react-virtualized/dist/commonjs/AutoSizer';
import Column from 'react-virtualized/dist/commonjs/Table/Column';
import Table from 'react-virtualized/dist/commonjs/Table';
import { List } from 'immutable';
import { Button } from 'react-bootstrap';

import { defaultRecDesc } from 'config';

import Collapsible from 'react-collapsible';
import RemoveWidget from 'components/RemoveWidget';
import SizeFormat from 'components/SizeFormat';
import TimeFormat from 'components/TimeFormat';
import WYSIWYG from 'components/WYSIWYG';
import { DownloadIcon, TrashIcon } from 'components/icons';

import { DateHeader } from './ancillary';

import './style.scss';


class SessionCollapsible extends PureComponent {

  static propTypes = {
    collection: PropTypes.object,
    deleteRec: PropTypes.func,
    expand: PropTypes.bool,
    onExpand: PropTypes.func,
    pagesBySession: PropTypes.object,
    recording: PropTypes.object,
    recordingEdited: PropTypes.bool,
    saveEdit: PropTypes.func
  };

  confirmDelete = () => {
    this.props.deleteRec(this.props.recording.get('id'));
  }

  downloadAction = (evt) => {
    evt.stopPropagation();
    const { collection, recording } = this.props;
    window.location = `/${collection.get('user')}/${collection.get('id')}/${recording.get('id')}/$download`;
  }

  editDescription = (txt) => {
    const { recording } = this.props;
    this.props.saveEdit(recording.get('id'), { desc: txt });
  }

  render() {
    const { expand, pagesBySession, recording } = this.props;

    const recId = recording.get('id');
    const pages = pagesBySession.hasOwnProperty(recId) ? pagesBySession[recId] : List();
    const pageCount = pages.size;

    const title = recording.get('title');
    const titleRender = (title ? (<span>{title}</span>) :
                                 (<span>Session from <TimeFormat iso={recording.get('created_at')} /></span>))

    const header = (
      <header className="collapsible">
        <div className="function-row">
          <RemoveWidget callback={this.confirmDelete} borderless={false} />
          <button onClick={this.downloadAction}><DownloadIcon /></button>
        </div>
        <h2>{titleRender}</h2>
        <span>{pageCount} Pages</span>
        <TimeFormat seconds={recording.get('duration')} />
        <SizeFormat bytes={recording.get('size')} />
      </header>
    );

    return (
      <div className="wr-coll-session">
        <Collapsible
          lazyRender
          open={expand}
          transitionTime={300}
          easing="ease-in-out"
          trigger={header}>
          <div className="function-coll">
            <DateHeader dt={recording.get('created_at')} />
            <div className="functions">
              <RemoveWidget
                callback={this.confirmDelete}
                classes="btn btn-default"
                borderless={false}>
                <TrashIcon /> Delete
              </RemoveWidget>
              <Button onClick={this.downloadAction}><DownloadIcon /> Download</Button>
            </div>
          </div>
          <div className="session-notes">
            <h4>Session Notes</h4>
            <WYSIWYG
              initial={recording.get('desc') || defaultRecDesc}
              onSave={this.editDescription}
              success={this.props.recordingEdited} />
          </div>
          <div className="session-pages">
            <h4>{`Session Pages (${pageCount})`}</h4>
            <AutoSizer>
              {
                ({ height, width }) => (
                  <Table
                    disableHeader
                    width={width}
                    height={height - 30}
                    rowHeight={30}
                    rowCount={pageCount}
                    rowGetter={({ index }) => pages.get(index)}>
                    <Column label="title" dataKey="title" width={200} flexGrow={1} />
                    <Column label="url" dataKey="url" width={200} flexGrow={1} />
                  </Table>
                )
              }
            </AutoSizer>
          </div>
        </Collapsible>
      </div>
    );
  }
}

export default SessionCollapsible;
