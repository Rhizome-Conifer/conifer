import React, { Component } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';

import { rts } from 'helpers/utils';

import TimeFormat from 'components/TimeFormat';


class BookmarkListItem extends Component {
  static contextTypes = {
    canAdmin: PropTypes.bool,
    router: PropTypes.object
  };

  static propTypes = {
    closeList: PropTypes.func,
    page: PropTypes.object,
    params: PropTypes.object,
    ts: PropTypes.string,
    url: PropTypes.string,
  };

  shouldComponentUpdate(nextProps, nextState) {
    const { page, ts, url } = this.props;

    if (nextProps.page === page &&
        nextProps.ts === ts &&
        nextProps.url === url) {
      return false;
    }

    return true;
  }

  changeUrl = () => {
    const { closeList, page, params: { user, coll} } = this.props;

    closeList();
    this.context.router.push(`/${user}/${coll}/${page.get('timestamp')}/${page.get('url')}`);
  }

  render() {
    const { page, ts, url } = this.props;
    const classes = classNames({ active: rts(url) === rts(page.get('url')) && ts === page.get('timestamp') });

    return (
      <li
        className={classes}
        onClick={this.changeUrl}
        role="button"
        title={page.get('url')}>
        {
          page.get('browser') &&
            <img src={`/api/browsers/browsers/${page.get('browser')}/icon`} alt="Browser icon" />
        }
        <div className="url">
          { page.get('url') }
        </div>
        <span className="replay-date hidden-xs"><TimeFormat dt={page.get('timestamp')} /></span>
      </li>
    );
  }
}

export default BookmarkListItem;
