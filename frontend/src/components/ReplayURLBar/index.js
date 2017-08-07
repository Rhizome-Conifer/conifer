import React, { Component } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';

import { RemoteBrowserSelect } from 'containers';

import BookmarkListItem from 'components/BookmarkListItem';
import OutsideClick from 'components/OutsideClick';
import ReplayArrowButton from 'components/ReplayArrowButton';
import ReplayPageDisplay from 'components/ReplayPageDisplay';
import TimeFormat from 'components/TimeFormat';

import './style.scss';


class ReplayURLBar extends Component {

  static propTypes = {
    recordings: PropTypes.array,
    params: PropTypes.object,
    recordingIndex: PropTypes.number
  }

  static contextTypes = {
    currMode: PropTypes.string,
    router: PropTypes.object
  }

  constructor(props) {
    super(props);

    this.state = { showList: false };
  }

  componentDidMount() {
    this.liHeight = Math.ceil(this.bookmarkList.querySelector('li').getBoundingClientRect().height);
  }

  changeURL = (evt, url) => {
    console.log(url);
  }

  closeBookmarkList = (evt) => {
    if(this.state.showList)
      this.setState({ showList: false });
  }

  toggleBookmarkList = (evt) => {
    evt.stopPropagation();
    const nextState = !this.state.showList;
    const { recordingIndex } = this.props;

    this.setState({ showList: nextState });

    if(nextState) {
      this.bookmarkList.scrollTop = (recordingIndex > 2 ? recordingIndex - 2 : 0) * this.liHeight;
    }
  }

  render() {
    const { recordings, recordingIndex, params } = this.props;
    const { currMode, canAdmin } = this.context;
    const { showList } = this.state;

    const { splat, ts, user } = params;
    const url = splat;

    const isReplay = currMode.indexOf('replay') !== -1;
    const isNew = currMode === 'new';
    const isExtract = currMode === 'extract';
    const isPatch = currMode === 'patch';

    const listClasses = classNames('bookmark-list', { open: showList });

    /* TODO: fabric-ify these */
    return (
      <div className="main-bar">
        <form className={classNames('form-group-recorder-url', { 'start-recording': currMode === 'new', 'content-form': currMode !== 'new', 'remote-archive': currMode in ['extract', 'patch'] })}>
          <div className="input-group containerized">
            <div className="input-group-btn rb-dropdown">
              {
                isReplay &&
                  <ReplayArrowButton
                    page={recordingIndex - 1 >= 0 ? recordings[recordingIndex - 1] : null}
                    params={params}
                    direction="left" />
              }
              {
                isReplay &&
                  <ReplayPageDisplay
                    index={recordingIndex}
                    total={recordings.length} />
              }
              {
                canAdmin &&
                  <RemoteBrowserSelect />
              }
            </div>
            {
              isReplay &&
                <OutsideClick handleClick={this.closeBookmarkList}>
                  <div className={listClasses} title="Bookmark list">
                    <input type="text" onClick={this.toggleBookmarkList} className="form-control dropdown-toggle" name="url" data-toggle="dropdown" aria-haspopup="true" value={url} autoComplete="off" />

                    <ul ref={(obj) => { this.bookmarkList = obj; }} className="dropdown-menu">
                      {
                        recordings.map((page, idx) =>
                          <BookmarkListItem
                            key={`${page.timestamp}${page.url}${idx}`}
                            page={page}
                            params={params}
                            closeList={this.closeBookmarkList} />
                        )
                      }
                    </ul>

                    <div className="wr-replay-info">
                      {/* info_widget(coll=coll_title) */}
                      <span className="replay-date main-replay-date hidden-xs" onClick={this.toggleBookmarkList}>
                        <TimeFormat dt={ts} />
                        <span className="glyphicon glyphicon-triangle-bottom" />
                      </span>
                    </div>
                  </div>
                </OutsideClick>
            }
            {
              isReplay &&
                <div className="input-group-btn hidden-xs">
                  <ReplayArrowButton
                    page={recordingIndex + 1 < recordings.length ? recordings[recordingIndex + 1] : null}
                    params={params}
                    direction="right" />
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
