import React, { Component } from 'react';
import PropTypes from 'prop-types';

import PageRow from 'components/collection/PageRow';


class PageList extends Component {
  static propTypes = {
    browsers: PropTypes.object,
    coll: PropTypes.object,
    hasActivePage: PropTypes.bool,
    onSelectRow: PropTypes.func,
    rec: PropTypes.object,
    pages: PropTypes.object,
    selectedGroupedPageIdx: PropTypes.number
  };

  render() {
    const { browsers, coll, hasActivePage, onSelectRow, pages,
            rec, selectedGroupedPageIdx } = this.props;

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
                  selected={hasActivePage && idx === selectedGroupedPageIdx} />
              );
            })
          }
        </tbody>
      </table>
    );
  }
}

export default PageList;
