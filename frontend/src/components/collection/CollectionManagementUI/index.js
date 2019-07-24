import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';
import querystring from 'querystring';
import { Button } from 'react-bootstrap';

import { applyLocalTimeOffset, getCollectionLink } from 'helpers/utils';
import config from 'config';

import { DeleteCollection, SessionCollapsible, Upload } from 'containers';

import HttpStatus from 'components/HttpStatus';
import SizeFormat from 'components/SizeFormat';
import TimeFormat from 'components/TimeFormat';
import { DownloadIcon, TrashIcon, UploadIcon, WarcIcon } from 'components/icons';

import './style.scss';


class CollectionManagementUI extends Component {
  static contextTypes = {
    canAdmin: PropTypes.bool,
    isAnon: PropTypes.bool
  };

  static propTypes = {
    auth: PropTypes.object,
    collection: PropTypes.object,
    location: PropTypes.object,
    recordings: PropTypes.object,
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
    window.location.href = `${config.appHost}/${getCollectionLink(collection)}/$download`;
  }

  render() {
    const { collection, recordings, location: { search } } = this.props;
    const { expandAll } = this.state;

    let activeSession = null;
    if (search) {
      const qs = querystring.parse(search.replace(/^\?/, ''));
      activeSession = qs.session;
    }

    if (!this.context.canAdmin) {
      return <HttpStatus status={401} />;
    }

    const utcCreated = new Date(collection.get('created_at'));
    const localCreated = applyLocalTimeOffset(utcCreated).toLocaleString();

    return (
      <div className="wr-coll-mgmt">
        <Helmet>
          <title>{`${collection.get('title')} Management`}</title>
        </Helmet>
        <div className="extra-info">
          <h4>Manage Sessions</h4>
          <p>Remove content from collection by <strong>deleting sessions</strong>. Add content by <strong>uploading warcs</strong>.</p>
          <span className="note">Please note that it is not possible to delete individual pages.</span>
        </div>
        <header>
          <h4>overview</h4>
          <div className="mgmt-overview">
            <WarcIcon />
            <div>
              <h2>{collection.get('title')}</h2>
              <div className="coll-info">
                <dl>
                  <dt>Created</dt>
                  <dd>{localCreated}</dd>

                  <dt>Contents</dt>
                  <dd>{recordings.size} session{recordings.size === 1 ? '' : 's'}</dd>

                  <dt>Size</dt>
                  <dd><SizeFormat bytes={collection.get('size')} /></dd>

                  <dt>Pages</dt>
                  <dd>{collection.get('pages').size}</dd>

                  <dt>Capture Time</dt>
                  <dd><TimeFormat seconds={collection.get('duration')} /></dd>

                  <dt>Coverage</dt>
                  <dd><TimeFormat seconds={collection.get('timespan')} /></dd>
                </dl>
              </div>
              <div className="function-row">
                <DeleteCollection>
                  <TrashIcon /> Delete Entire Collection
                </DeleteCollection>
                <Button onClick={this.downloadAction}>
                  <DownloadIcon /> { __DESKTOP__ ? 'Export' : 'Download' } Collection as WARC
                </Button>
                {
                  !this.context.isAnon &&
                    <Upload fromCollection={collection.get('id')} classes="btn btn-default">
                      <UploadIcon /> { __DESKTOP__ ? 'Import' : 'Upload' } WARC to Collection
                    </Upload>
                }
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
                  active={rec.get('id') === activeSession}
                  key={rec.get('id')}
                  expand={expandAll || rec.get('id') === activeSession}
                  recording={rec} />
              );
            })
          }
        </section>
      </div>
    );
  }
}


export default CollectionManagementUI;
