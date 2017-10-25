import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Collapsible from 'react-collapsible';

import PageList from 'components/PageList';
import TimeFormat from 'components/TimeFormat';
import SizeFormat from 'components/SizeFormat';


class SessionCollapsible extends PureComponent {

  static propTypes = {
    collection: PropTypes.object,
    browsers: PropTypes.object,
    expandAll: PropTypes.bool,
    hasActiveBookmark: PropTypes.bool,
    onCollapse: PropTypes.func,
    onExpand: PropTypes.func,
    onSelectRow: PropTypes.func,
    recording: PropTypes.object,
    selectedGroupedBookmarkIdx: PropTypes.number
  };

  expandCallback = () => {
    this.props.onExpand(this.props.recording);
  }

  render() {
    const { collection, browsers, expandAll, hasActiveBookmark, onCollapse,
            onSelectRow, recording, selectedGroupedBookmarkIdx } = this.props;
    const pageCount = recording.get('pages').size;

    const header = (
      <header className={classNames({ collapsible: pageCount > 0 })}>
        { pageCount > 0 && <span className="glyphicon glyphicon-triangle-right" />}
        <h2>{recording.get('title')}</h2>
        <TimeFormat classes="session-ts" epoch={recording.get('updated_at')} />
        <SizeFormat bytes={recording.get('size')} />
      </header>
    );

    return (
      <div className="wr-coll-session">
        <Collapsible
          lazyRender
          open={expandAll}
          transitionTime={Math.max(150, Math.min(700, pageCount * 60))}
          onOpen={this.expandCallback}
          onClose={onCollapse}
          easing="ease-out"
          trigger={header}>
          <PageList
            browsers={browsers}
            coll={collection}
            hasActiveBookmark={hasActiveBookmark}
            rec={recording}
            pages={recording.get('pages')}
            onSelectRow={onSelectRow}
            selectedGroupedBookmarkIdx={selectedGroupedBookmarkIdx} />
        </Collapsible>
      </div>
    );
  }
}

export default SessionCollapsible;
