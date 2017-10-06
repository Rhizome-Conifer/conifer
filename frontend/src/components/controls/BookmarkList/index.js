import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import { InfoWidget} from 'containers';

import BookmarkListItem from 'components/controls/BookmarkListItem';
import OutsideClick from 'components/OutsideClick';
import TimeFormat from 'components/TimeFormat';


class BookmarkList extends Component {
  static propTypes = {
    bookmarks: PropTypes.object,
    params: PropTypes.object,
    recordingIndex: PropTypes.number,
    timestamp: PropTypes.string,
    url: PropTypes.string
  };

  static contextTypes = {
    router: PropTypes.object
  }

  constructor(props) {
    super(props);

    this.state = { showList: false, url: props.url };
  }

  componentDidMount() {
    this.liHeight = Math.ceil(this.bookmarkList.querySelector('li').getBoundingClientRect().height);
  }

  componentWillReceiveProps(nextProps) {
    if(nextProps.url !== this.props.url) {
      this.setState({ url: nextProps.url });
    }
  }

  close = () => {
    if(this.state.showList)
      this.setState({ showList: false });
  }

  toggle = (evt) => {
    evt.stopPropagation();
    const nextState = !this.state.showList;
    const { recordingIndex } = this.props;

    this.setState({ showList: nextState });

    if(nextState) {
      this.bookmarkList.scrollTop = (recordingIndex > 2 ? recordingIndex - 2 : 0) * this.liHeight;
    }
  }

  // TODO: update iframe src not page url
  changeUrl = () => {
    const { params: { user, coll } } = this.props;
    const { url } = this.state;

    this.close();
    this.context.router.push(`/${user}/${coll}/${url}`);
  }

  handleInput = (evt) => {
    evt.preventDefault();
    this.setState({ url: evt.target.value });
  }

  handleSubmit = (evt) => {
    if (evt.key === 'Enter') {
      console.log('unimplemented');
      //this.changeUrl();
    }
  }

  render() {
    const { bookmarks, params, timestamp } = this.props;
    const { url } = this.state;
    const { showList } = this.state;

    const listClasses = classNames('bookmark-list', { open: showList });

    return (
      <OutsideClick handleClick={this.close}>
        <div className={listClasses} title="Bookmark list">
          <input type="text" onClick={this.toggle} onChange={this.handleInput} onKeyPress={this.handleSubmit} className="form-control dropdown-toggle" name="url" aria-haspopup="true" value={url} autoComplete="off" />

          <ul ref={(obj) => { this.bookmarkList = obj; }} className="dropdown-menu">
            {
              bookmarks.map((page, idx) =>
                <BookmarkListItem
                  key={`${page.get('timestamp')}${page.url}${idx}`}
                  page={page}
                  params={params}
                  ts={timestamp}
                  url={url}
                  closeList={this.close} />
              )
            }
          </ul>

          <div className="wr-replay-info">
            <InfoWidget />
            <span className="replay-date main-replay-date hidden-xs" onClick={this.toggle}>
              <TimeFormat dt={timestamp} />
              <span className="glyphicon glyphicon-triangle-bottom" />
            </span>
          </div>
        </div>
      </OutsideClick>
    );
  }
}

export default BookmarkList;
