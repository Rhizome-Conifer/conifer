import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import { RemoteBrowserSelect } from 'containers';

import './style.scss';

class ReplayURLBar extends Component {

  static propTypes = {
    recordings: PropTypes.array,
    ts: PropTypes.string,
    url: PropTypes.string
  }

  static contextTypes = {
    currMode: PropTypes.string
  }

  render() {
    const { recordings, ts, url } = this.props;
    const { currMode, canAdmin } = this.context;

    const isReplay = currMode.indexOf('replay') !== -1;
    const isNew = currMode === 'new';
    const isExtract = currMode === 'extract';
    const isPatch = currMode === 'patch';

    return (
      <div className="main-bar">
        <form className={classNames('form-group-recorder-url', { 'start-recording': currMode === 'new', 'content-form': currMode !== 'new', 'remote-archive': currMode in ['extract', 'patch'] })}>
          <div className="input-group containerized">
            <div className="input-group-btn rb-dropdown">
              {
                isReplay &&
                  <button type="button" className="btn btn-default btn-prev hidden-xs" title="Previous bookmark"><span className="glyphicon glyphicon-chevron-left" /></button>
              }
              {
                isReplay &&
                  <input type="text" id="page-display" className="form-control hidden-sm hidden-xs" title="Bookmark index" value="-" readOnly />
              }

              {
                canAdmin &&
                  <RemoteBrowserSelect />
              }
            </div>
            {
              isReplay &&
                <div className="linklist" title="Bookmark list">
                  <input type="text" className="form-control dropdown-toggle" name="url" data-toggle="dropdown" aria-haspopup="true" data-target-decoded="value" value={url} />
                  <ul className="dropdown-menu">
                    {
                      recordings.map(rec =>
                        rec.map(page =>
                          <li key={`${page.timestamp}${page.url}`} title={page.url}>
                            {
                              !canAdmin && page.br &&
                                <img src="/api/browsers/browsers/{{ page.br }}/icon" alt="Browser icon" />
                            }
                            <div className="url">
                              { page.url }
                            </div>
                            <span className="replay-date hidden-xs">{ page.ts }</span>
                          </li>
                        )
                      )
                    }
                  </ul>
                  <div className="wr-replay-info">
                    {/* info_widget(coll=coll_title) */}
                    <span className="replay-date main-replay-date hidden-xs" />
                  </div>
                </div>
            }
            {
              isReplay &&
                <div className="input-group-btn hidden-xs">
                  <button type="button" className="btn btn-default btn-next" title="Next bookmark"><span className="glyphicon glyphicon-chevron-right" /></button>
                </div>
            }
            {
              !isReplay &&
                <input type="text" className="url-input-recorder form-control" name="url" value="value" autoFocus required />
            }
            {
              canAdmin && isNew &&
                <div className="input-group-btn extract-selector">
                  {/* sources_widget(target=coll_title) */}
                  <button className="btn btn-default" type="submit" role="button" aria-label="Extract">
                    <span className="glyphicon glyphicon-save" aria-hidden="true" /> <span>extract</span>
                  </button>
                </div>
            }
            {
              isNew &&
                <div className="input-group-btn record-action">
                  <form className="start-recording">
                    <button type="submit" className="btn btn-default">
                      Start
                    </button>
                  </form>
                </div>
            }
            {/*
              isExtract &&
                <div class="input-group-btn extract-selector">
                    {{ sources_widget(target=coll_title, active=True, req_timestamp=(ts or (wbrequest.wb_url.timestamp if webrequest else None))) }}
                </div>
              */
            }
            {
              /*
              isPatch &&
                <div class="input-group-btn extract-selector">
                  {{ sources_widget(target=rec_title, active=True, mode="patch", timestamp=(ts or wbrequest.wb_url.timestamp)) }}
                </div>
              */
            }
          </div>
        </form>
      </div>
    );
  }
}

export default ReplayURLBar;
