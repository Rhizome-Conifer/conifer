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
    params: PropTypes.object
  };

  changeUrl = () => {
    const { closeList, params, page } = this.props;
    const { user, coll } = params;

    closeList();
    this.context.router.push(`/${user}/${coll}/${page.get('timestamp')}/${page.get('url')}`);
  }

  render() {
    const { page, params } = this.props;
    const { canAdmin } = this.context;

    const { splat, ts } = params;
    const url = splat;
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
