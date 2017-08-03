import React, { Component } from 'react';
import PropTypes from 'prop-types';

import findIndex from 'lodash/findIndex';


class ReplayPageDisplay extends Component {
  static propTypes = {
    bookmarks: PropTypes.array,
    url: PropTypes.string,
    ts: PropTypes.string
  };

  getIndex = () => {
    const { bookmarks, ts, url } = this.props;

    if (!ts) {
      const idx = findIndex(bookmarks, (b) => { return b.url === url || b.url.replace(/\/$/, '') === url.replace(/\/$/, ''); });
      return idx === -1 ? 0 : idx;
    }

    const item = { url, ts: parseInt(ts, 10) };
    let minIdx = 0;
    let maxIdx = bookmarks.length - 1;
    let curIdx;
    let curEle;

    while (minIdx <= maxIdx) {
      curIdx = ((minIdx + maxIdx) / 2) | 0;
      curEle = parseInt(bookmarks[curIdx].timestamp, 10);

      if (curEle < item.ts) {
        minIdx = curIdx + 1;
      } else if (curEle > item.ts) {
        maxIdx = curIdx - 1;
      } else if (curEle === item.ts && (item.url !== bookmarks[curIdx].url && item.url.replace(/\/$/, '') !== bookmarks[curIdx].url.replace(/\/$/, ''))) {
        /**
         * If multiple recordings are within a timestamp, or if the url
         * for the timestamp doesn't match exactly, iterate over other
         * options. If no exact match is found, resolve to first ts match.
         */
        let tempUrl;
        const origIdx = curIdx;
        while (curEle === item.ts && curIdx < bookmarks.length - 1) {
          tempUrl = bookmarks[++curIdx].url;
          curEle = parseInt(bookmarks[curIdx].ts, 10);
          if (tempUrl === item.url) {
            return curIdx;
          }
        }
        return origIdx;
      } else {
        return curIdx;
      }
    }

    return 0;
  }

  render() {
    const { bookmarks } = this.props;

    const value = `${this.getIndex() + 1} of ${bookmarks.length}`;

    return (
      <input type="text" id="page-display" className="form-control hidden-sm hidden-xs" title="Bookmark index" size={value.length} value={value} readOnly />
    );
  }
}

export default ReplayPageDisplay;
