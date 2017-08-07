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
    this.context.router.push(`/${user}/${coll}/${page.timestamp}/${page.url}`);
  }

  render() {
    const { page, params } = this.props;
    const { canAdmin } = this.context;

    const { splat, ts } = params;
    const url = splat;
    const classes = classNames({ active: rts(url) === rts(page.url) && ts === page.timestamp });

    return (
      <li
        className={classes}
        onClick={this.changeUrl}
        role="button"
        title={page.url}>
        {
          !canAdmin && page.br &&
            <img src={`/api/browsers/browsers/${page.br}/icon`} alt="Browser icon" />
        }
        <div className="url">
          { page.url }
        </div>
        <span className="replay-date hidden-xs"><TimeFormat dt={page.timestamp} /></span>
      </li>
    );
  }
}

export default BookmarkListItem;
