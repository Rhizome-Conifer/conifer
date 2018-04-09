import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import AutoSizer from 'react-virtualized/dist/commonjs/AutoSizer';
import Column from 'react-virtualized/dist/commonjs/Table/Column';
import Table from 'react-virtualized/dist/commonjs/Table';

import Collapsible from 'react-collapsible';
import RemoveWidget from 'components/RemoveWidget';
import SizeFormat from 'components/SizeFormat';
import TimeFormat from 'components/TimeFormat';
import WYSIWYG from 'components/WYSIWYG';

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

  render() {
    const { collection, expand, recording } = this.props;
    const pageCount = recording.get('pages').size;

    const header = (
      <header className={classNames({ collapsible: pageCount > 0 })}>
        { pageCount > 0 && <span className="glyphicon glyphicon-triangle-right" />}
        <h2>{recording.get('title')}</h2>
        <span className="badge">{ recording.get('pages').size }</span>
        <TimeFormat classes="session-ts" iso={recording.get('updated_at')} />
        <SizeFormat bytes={recording.get('size')} />
      </header>
    );

    const pages = recording.get('pages');

    return (
      <div className="wr-coll-session">
        <RemoveWidget callback={this.confirmDelete} />
        <Collapsible
          lazyRender
          open={expand}
          transitionTime={300}
          easing="ease-in-out"
          trigger={header}>
          <div className="session-notes">
            <h4>Session Notes</h4>
            <WYSIWYG initial="Recording notes go here..." />
          </div>
          <div className="session-pages">
            <h4>{`Session Pages (${pages.size})`}</h4>
            <AutoSizer>
              {
                ({ height, width }) => (
                  <Table
                    disableHeader
                    width={width}
                    height={height - 10}
                    rowHeight={30}
                    rowCount={pages.size}
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
