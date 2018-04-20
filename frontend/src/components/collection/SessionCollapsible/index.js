import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import AutoSizer from 'react-virtualized/dist/commonjs/AutoSizer';
import Column from 'react-virtualized/dist/commonjs/Table/Column';
import Table from 'react-virtualized/dist/commonjs/Table';
import { Button } from 'react-bootstrap';

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
    recording: PropTypes.object
  };

  confirmDelete = () => {
    this.props.deleteRec(this.props.recording.get('id'));
  }

  downloadAction = (evt) => {
    evt.stopPropagation();
    const { collection, recording } = this.props;
    window.location = `/${collection.get('user')}/${collection.get('id')}/${recording.get('id')}/$download`;
  }

  render() {
    const { expand, recording } = this.props;

    const pageCount = recording.get('pages').size;
    const pages = recording.get('pages');

    const header = (
      <header className={classNames({ collapsible: pageCount > 0 })}>
        <div className="function-row">
          <RemoveWidget callback={this.confirmDelete} borderless={false} />
          <button onClick={this.downloadAction}><DownloadIcon /></button>
        </div>
        <h2>{recording.get('title')}</h2>
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
            <WYSIWYG initial="Recording notes go here..." />
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
