import React, { Component } from 'react';
import PropTypes from 'prop-types';

import PageRow from 'components/PageRow';


class PageList extends Component {
  static propTypes = {
    browsers: PropTypes.object,
    coll: PropTypes.object,
    hasActiveBookmark: PropTypes.bool,
    onSelectRow: PropTypes.func,
    rec: PropTypes.object,
    pages: PropTypes.object,
    selectedGroupedBookmarkIdx: PropTypes.number
  };

  render() {
    const { browsers, coll, hasActiveBookmark, onSelectRow, pages,
            rec, selectedGroupedBookmarkIdx } = this.props;

    return (
      <table className="table table-noborder table-hover table-bookmarks">
        <tbody>
          {
            pages.map((page, idx) => {
              const browser = page.get('browser');
              const browserObj = browser && browsers.has(browser) ? browsers.get(browser) : null;

              return (
                <PageRow
                  key={page.get('url') + page.get('timestamp')}
                  browserObj={browserObj}
                  coll={coll}
                  index={idx}
                  onSelectRow={onSelectRow}
                  page={page}
                  rec={rec}
                  selected={hasActiveBookmark && idx === selectedGroupedBookmarkIdx} />
              );
            })
          }
        </tbody>
      </table>
    );
  }
}

export default PageList;
