import React, { Component } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';

import { RemoteBrowserSelect } from 'containers';

import BookmarkListItem from 'components/BookmarkListItem';
import OutsideClick from 'components/OutsideClick';
import TimeFormat from 'components/TimeFormat';

import { ReplayArrowButton, ReplayPageDisplay } from 'components/controls';

import './style.scss';


class ReplayURLBar extends Component {
  static contextTypes = {
    canAdmin: PropTypes.bool,
    currMode: PropTypes.string,
    router: PropTypes.object
  }

  static propTypes = {
    bookmarks: PropTypes.object,
    params: PropTypes.object,
    recordingIndex: PropTypes.number
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

  closeBookmarkList = () => {
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
    const { bookmarks, recordingIndex, params } = this.props;
    const { canAdmin } = this.context;
    const { showList } = this.state;

    const { splat, ts } = params;
    const url = splat;

    const listClasses = classNames('bookmark-list', { open: showList });

    /* TODO: fabric-ify these */
    return (
      <div className="main-bar">
        <form className="form-group-recorder-url">
          <div className="input-group containerized">
            <div className="input-group-btn rb-dropdown">
              <ReplayArrowButton
                page={recordingIndex - 1 >= 0 ? bookmarks.get(recordingIndex - 1) : null}
                params={params}
                direction="left" />
              <ReplayPageDisplay
                index={recordingIndex}
                total={bookmarks.size} />
              {
                canAdmin &&
                  <RemoteBrowserSelect />
              }
            </div>
            <OutsideClick handleClick={this.closeBookmarkList}>
              <div className={listClasses} title="Bookmark list">
                <input type="text" onClick={this.toggleBookmarkList} className="form-control dropdown-toggle" name="url" aria-haspopup="true" value={url} autoComplete="off" />

                <ul ref={(obj) => { this.bookmarkList = obj; }} className="dropdown-menu">
                  {
                    bookmarks.map((page, idx) =>
                      <BookmarkListItem
                        key={`${page.get('timestamp')}${page.url}${idx}`}
                        page={page}
                        params={params}
                        closeList={this.closeBookmarkList} />
                    )
                  }
                </ul>

                <div className="wr-replay-info">
                  {/* info_widget(coll=coll_title) */}
                  <span className="replay-date main-replay-date hidden-xs">
                    <TimeFormat dt={ts} />
                    <span className="glyphicon glyphicon-triangle-bottom" />
                  </span>
                </div>
              </div>
            </OutsideClick>
            <div className="input-group-btn hidden-xs">
              <ReplayArrowButton
                page={recordingIndex + 1 < bookmarks.size ? bookmarks.get(recordingIndex + 1) : null}
                params={params}
                direction="right" />
            </div>
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
