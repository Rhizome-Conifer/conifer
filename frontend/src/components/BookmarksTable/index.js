import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router';
import capitalize from 'lodash/capitalize';

import EditableString from 'components/EditableString';
import TimeFormat from 'components/TimeFormat';

import './style.scss';

class BookmarksTable extends Component {
  static propTypes = {
    collection: PropTypes.object,
    browsers: PropTypes.object
  };

  static contextTypes = {
    canAdmin: PropTypes.bool
  }

  render() {
    const { browsers, collection } = this.props;
    const { canAdmin } = this.context;

    const { recordings } = collection.collection;

    return (
      <div className="bookmarks-panel">
        <table className="table table-noborder table-striped table-hover table-bookmarks">
          <thead>
            <tr>
              { canAdmin &&
                <th className="bookmark-hidden-switch hidden-xs" style={{ width: '39px' }}>
                  <input type="checkbox" className="left-buffer-sm" id="show-hidden" name="show-hidden" checked="checked" />
                </th>
              }
              { canAdmin &&
                <th className="bookmark-edit-title" style={{ width: '1px' }} />
              }
              <th className="bookmark-title"><span>Bookmarks</span></th>
              <th className="bookmark-browser hidden-xs hidden-sm hidden-md">Browser</th>
              <th className="timestamp">Timestamp</th>
              <th className="bookmark-url hidden-xs">URL</th>
              <th className="bookmark-recording-title hidden-xs hidden-sm">Recording</th>
            </tr>
          </thead>
          <tbody>
            {
              recordings.map(rec =>
                rec.pages.map(page =>
                  <tr key={`${page.timestamp}${page.url}`}>
                    <td className="bookmark-hidden-switch" />
                    <td className="bookmark-edit-title" />
                    <td className="bookmark-title">
                      <Link to={`/${collection.user}/${collection.coll}/${page.timestamp}${page.browser ? `$br:${page.browser}` : ''}/${page.url}`}>
                        <EditableString
                          string={page.title}
                          className="edit-coll-title" />
                      </Link>
                    </td>
                    <td className="rec-browser" >
                      {
                        page.browser && page.browser in browsers ?
                          <img src={`/api/browsers/browsers/${browsers[page.browser].id}/icon`} alt={`Recorded with ${capitalize(browsers[page.browser].name)} version ${browsers[page.browser].version}`} /> :
                          '-'
                      }
                    </td>
                    <td className="timestamp"><TimeFormat dt={page.timestamp} /></td>
                    <td className="bookmark-url">{page.url}</td>
                    <td className="bookmark-recording-title">{rec.title}</td>
                  </tr>
                )
              )
            }
          </tbody>
        </table>
      </div>
    );
  }
}

export default BookmarksTable;
