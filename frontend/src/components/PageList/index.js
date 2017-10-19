import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router';

import { capitalize } from 'helpers/utils';

import EditableString from 'components/EditableString';
import TimeFormat from 'components/TimeFormat';


class PageList extends Component {
  static propTypes = {
    browsers: PropTypes.object,
    coll: PropTypes.object,
    pages: PropTypes.object
  };

  render() {
    const { browsers, coll, pages } = this.props;

    return (
      <table className="table table-noborder table-striped table-hover table-bookmarks">
        <tbody>
          {
            pages.sortBy(o => o.get('timestamp')).toOrderedSet().map((page) => {
              const url = page.get('url');
              const ts = page.get('timestamp');
              const browser = page.get('browser');
              const browserObj = browser && browsers.has(browser) ? browsers.get(browser) : null;

              return (
                <tr key={`${ts}${url}`}>
                  <td className="bookmark-hidden-switch"><span className="glyphicon glyphicon-star" /></td>
                  <td className="bookmark-edit-title"><span className="glyphicon glyphicon-bookmark" /></td>
                  <td className="timestamp"><TimeFormat dt={ts} /></td>
                  <td className="bookmark-title">
                    <Link to={`/${coll.get('user')}/${coll.get('id')}/${ts}${browser ? `$br:${browser}` : ''}/${url}`}>
                      <EditableString
                        string={page.get('title') || 'No Title'}
                        className="edit-coll-title" />
                    </Link>
                  </td>
                  <td className="bookmark-url">{url}</td>
                  <td>#page</td>
                  <td className="rec-browser" >
                    {
                      browserObj ?
                        <span>
                          <img src={`/api/browsers/browsers/${browserObj.get('id')}/icon`} alt={`Recorded with ${capitalize(browserObj.get('name'))} version ${browserObj.get('version')}`} />
                          { ` v${browserObj.get('version')}` }
                        </span> :
                        ''
                    }
                  </td>
                </tr>
              );
            })
          }
        </tbody>
      </table>
    );
  }
}

export default PageList;
