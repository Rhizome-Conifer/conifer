import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import AutoSizer from 'react-virtualized/dist/commonjs/AutoSizer';
import Column from 'react-virtualized/dist/commonjs/Table/Column';
import Table from 'react-virtualized/dist/commonjs/Table';
import classNames from 'classnames';
import Collapsible from 'react-collapsible';
import { List } from 'immutable';
import { Button, Overlay, Popover } from 'react-bootstrap';

import { defaultRecDesc } from 'config';
import { getCollectionLink } from 'helpers/utils';

import { getRecordingBookmarks } from 'store/modules/recordings';

import OutsideClick from 'components/OutsideClick';
import SizeFormat from 'components/SizeFormat';
import TimeFormat from 'components/TimeFormat';
import WYSIWYG from 'components/WYSIWYG';
import { DownloadIcon, LoaderIcon, TrashIcon } from 'components/icons';

import { DateHeader } from './ancillary';

import './style.scss';


class SessionCollapsibleUI extends PureComponent {

  static propTypes = {
    active: PropTypes.bool,
    collection: PropTypes.object,
    deleteRec: PropTypes.func,
    dispatch: PropTypes.func,
    editRec: PropTypes.func,
    expand: PropTypes.bool,
    loadedRecBK: PropTypes.bool,
    loadingRecBK: PropTypes.bool,
    pagesBySession: PropTypes.object,
    recording: PropTypes.object,
    recordingBookmarks: PropTypes.object,
    recordingEdited: PropTypes.bool,
    recordingDeleted: PropTypes.bool,
    recordingDeleting: PropTypes.bool,
    saveEdit: PropTypes.func
  };

  constructor(props) {
    super(props);

    this.state = {
      deletePopover: false,
      open: false
    };
  }

  componentDidMount() {
    if (this.props.active) {
      // delay to avoid conflict with app scroll restoration
      setTimeout(() => window.scrollTo(0, this.container.offsetTop), 500);
    }
  }

  onExpand = () => this.setState({ open: true })
  onCollapse = () => this.setState({ open: false })

  closeDeletePopover = () => this.setState({ deletePopover: false })

  confirmDelete = () => {
    const { collection, deleteRec, recording } = this.props;
    deleteRec(collection.get('owner'), collection.get('id'), recording.get('id'));
  }

  downloadAction = (evt) => {
    evt.stopPropagation();
    const { collection, recording } = this.props;
    window.location = `${getCollectionLink(collection)}/${recording.get('id')}/$download`;
  }

  editDescription = (txt) => {
    const { collection, editRec, recording } = this.props;
    editRec(collection.get('owner'), collection.get('id'), recording.get('id'), { desc: txt });
  }

  toggleDeletePopover = (evt) => {
    evt.stopPropagation();
    const { collection, dispatch, recording } = this.props;

    // check if deletion will effect any lists
    if (!this.state.deletePopover) {
      dispatch(getRecordingBookmarks(collection.get('owner'), collection.get('id'), recording.get('id')));
    }

    this.setState({ deletePopover: !this.state.deletePopover });
  }

  render() {
    const { expand, loadingRecBK, loadedRecBK, pagesBySession, recording,
            recordingDeleting, recordingBookmarks } = this.props;

    const recId = recording.get('id');
    const pages = pagesBySession.hasOwnProperty(recId) ? pagesBySession[recId] : List();
    const pageCount = pages.size;
    const popoverClasses = classNames({ 'popover-open': this.state.deletePopover });
    const title = recording.get('title');
    const titleRender = (title ? (<span>{title}</span>) :
                                 (<span>Session from <TimeFormat iso={recording.get('created_at')} /></span>));

    const header = (
      <header className="collapsible">
        <div className="function-row">
          <button className="delete-action" ref={(o) => { this.collapsed = o; }} onClick={this.toggleDeletePopover}><TrashIcon /></button>
          <button onClick={this.downloadAction}><DownloadIcon /></button>
        </div>
        <h2>{titleRender}</h2>
        <span>{pageCount} Pages</span>
        <TimeFormat seconds={recording.get('duration')} />
        <SizeFormat bytes={recording.get('size')} />
      </header>
    );

    const bookmarksInRecording = loadedRecBK && recordingBookmarks.reduce((sum, coll) => coll.size + sum, 0);
    const deleteMessage = (
      loadedRecBK && bookmarksInRecording > 0 ?
        (<React.Fragment>
          <h4>Deleting Sessions and Bookmarks</h4>
          This <b><SizeFormat bytes={recording.get('size')} /></b> session contains page(s) referenced by {loadedRecBK ? <b>{recordingBookmarks.size} bookmarks. </b> : 'checking...'}
          <div className="warning">Deleting the session will also delete these bookmarks.</div>
        </React.Fragment>) :
        <div className="warning">This <b><SizeFormat bytes={recording.get('size')} /></b> session will be deleted.</div>
    );

    return (
      <div className="wr-coll-session" ref={(o) => { this.container = o; }}>
        <Collapsible
          lazyRender
          open={expand}
          transitionTime={300}
          onOpen={this.onExpand}
          onClose={this.onCollapse}
          easing="ease-in-out"
          trigger={header}
          className={popoverClasses}
          contentInnerClassName={popoverClasses}>
          <div className="function-coll">
            <DateHeader dt={recording.get('created_at')} />
            <div className="functions">
              <Button ref={(o) => { this.expanded = o; }} onClick={this.toggleDeletePopover}><TrashIcon /> Delete</Button>
              <Button onClick={this.downloadAction}><DownloadIcon /> Download</Button>
            </div>
          </div>
          <div className="session-notes">
            <h4>Session Notes</h4>
            <WYSIWYG
              initial={recording.get('desc')}
              onSave={this.editDescription}
              placeholder={defaultRecDesc}
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
        <Overlay shouldUpdatePosition target={this.state.open || expand ? this.expanded : this.collapsed} container={this} show={this.state.deletePopover} placement="right">
          <Popover id="wr-popover-delete" placement="right">
            <OutsideClick handleClick={this.closeDeletePopover}>
              {
                loadingRecBK ?
                  <p>Checking for bookmarks...</p> :
                  deleteMessage
              }
              <div className="action-row">
                <Button onClick={this.closeDeletePopover}>Cancel</Button>
                <Button bsStyle="danger" onClick={this.confirmDelete} disabled={recordingDeleting}>{recordingDeleting ? <LoaderIcon /> : 'OK'}</Button>
              </div>
            </OutsideClick>
          </Popover>
        </Overlay>
      </div>
    );
  }
}

export default SessionCollapsibleUI;
