import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Link } from 'react-router-dom';

import { capitalize, remoteBrowserMod } from 'helpers/utils';
import TimeFormat from 'components/TimeFormat';


class PageRow extends Component {
  static propTypes = {
    browserObj: PropTypes.object,
    coll: PropTypes.object,
    index: PropTypes.number,
    onSelectRow: PropTypes.func,
    page: PropTypes.object,
    rec: PropTypes.object,
    selected: PropTypes.bool
  };

  selectRow = () => {
    const { index, rec } = this.props;

    this.props.onSelectRow({
      rec,
      index
    });
  }

  render() {
    const { browserObj, coll, page, selected } = this.props;

    const browser = page.get('browser');
    const url = page.get('url');
    const ts = page.get('timestamp');

    return (
      <tr
        className={classNames({ selected })}
        onClick={this.selectRow}
        onTransitionEnd={e => e.stopPropagation()}
        role="button">
        <td className="timestamp"><TimeFormat dt={ts} /></td>
        <td className="bookmark-title">
          <Link to={`/${coll.get('owner')}/${coll.get('id')}/${remoteBrowserMod(browser, ts)}/${url}`}>
            {page.get('title') || 'No Title'}
          </Link>
        </td>
        <td className="bookmark-url">{url}</td>
        <td className="rec-browser" >
          {
            browserObj &&
              <span>
                <img src={`/api/browsers/browsers/${browserObj.get('id')}/icon`} alt={`Recorded with ${capitalize(browserObj.get('name'))} version ${browserObj.get('version')}`} />
                { ` v${browserObj.get('version')}` }
              </span>
          }
        </td>
      </tr>
    );
  }
}

export default PageRow;
