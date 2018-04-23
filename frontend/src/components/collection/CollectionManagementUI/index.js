import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'react-bootstrap';

import { DeleteCollection, Upload } from 'containers';

import HttpStatus from 'components/HttpStatus';
import SessionCollapsible from 'components/collection/SessionCollapsible';
import SizeFormat from 'components/SizeFormat';
import TimeFormat from 'components/TimeFormat';
import { DownloadIcon, TrashIcon, WarcIcon } from 'components/icons';

import './style.scss';


class CollectionManagementUI extends Component {
  static contextTypes = {
    canAdmin: PropTypes.bool
  };

  static propTypes = {
    auth: PropTypes.object,
    collection: PropTypes.object,
    deleteRec: PropTypes.func,
    editRec: PropTypes.func,
    recordingEdited: PropTypes.bool,
    recordings: PropTypes.object,
    loaded: PropTypes.bool,
    totalDuration: PropTypes.number
  };

  constructor(props) {
    super(props);

    this.state = {
      expandAll: false
    };
  }

  toggleAll = () => {
    this.setState({ expandAll: !this.state.expandAll });
  }

  downloadAction = (evt) => {
    const { collection } = this.props;
    window.location = `/${collection.get('user')}/${collection.get('id')}/$download`;
  }

  saveRecordingEdit = (rec, data) => {
    this.props.editRec(rec, data);
  }

  render() {
    const { collection, recordings } = this.props;
    const { expandAll } = this.state;

    if (!this.context.canAdmin) {
      return <HttpStatus status={401} />;
    }

    return (
      <div className="wr-coll-mgmt">
        <div className="extra-info">
          <h4>Manage Collection Content</h4>
          <p>Remove content from collection by <strong>deleting capture sessions</strong>. Add content by <strong>uploading warcs</strong>.</p>
          <span className="note">Please note that it is not possible to delete individual pages. <a href="#">Please see this guide for best capture practices.</a></span>
        </div>
        <header>
          <h4>overview</h4>
          <div className="mgmt-overview">
            <WarcIcon />
            <div>
              <h2>{collection.get('title')}</h2>
              <span className="created-at">Created on <TimeFormat iso={collection.get('created_at')} /></span>
              <div className="coll-info">
                <strong>{recordings.size}</strong> capture sessions over approximately <strong><TimeFormat seconds={collection.get('timespan')} /></strong> containing <strong>{collection.get('pages').size} pages</strong>. Total capture time is <strong><TimeFormat seconds={collection.get('duration')} /></strong> and total data size is <strong><SizeFormat bytes={collection.get('size')} /></strong>.
              </div>
              <div className="function-row">
                <DeleteCollection>
                  <Button>
                    <TrashIcon /> Delete Entire Collection
                  </Button>
                </DeleteCollection>
                <Button onClick={this.downloadAction}>
                  <DownloadIcon /> Download Collection
                </Button>
                <Upload fromCollection={collection.get('id')} classes="btn btn-default">
                  <WarcIcon /> Upload to Collection
                </Upload>
              </div>
            </div>
          </div>
        </header>
        <section>
          <div className="session-head">
            <h3>Sessions</h3>
            <Button bsSize="sm" onClick={this.toggleAll}>
              { expandAll ? 'Collapse All' : 'Expand All' }
            </Button>
          </div>
          {
            recordings.map((rec) => {
              return (
                <SessionCollapsible
                  key={rec.get('id')}
                  deleteRec={this.props.deleteRec}
                  collection={collection}
                  expand={expandAll}
                  recording={rec}
                  recordingEdited={this.props.recordingEdited}
                  onSelectRow={this.onSelectGroupedRow}
                  saveEdit={this.saveRecordingEdit} />
              );
            })
          }
        </section>
      </div>
    );
  }
}


export default CollectionManagementUI;
