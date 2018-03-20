import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import Collapsible from 'react-collapsible';
import RemoveWidget from 'components/RemoveWidget';
import PageList from 'components/PageList';
import SizeFormat from 'components/SizeFormat';
import TimeFormat from 'components/TimeFormat';

import './style.scss';


class SessionCollapsible extends PureComponent {

  static propTypes = {
    browsers: PropTypes.object,
    collection: PropTypes.object,
    deleteRec: PropTypes.func,
    expand: PropTypes.bool,
    hasActivePage: PropTypes.bool,
    onCollapse: PropTypes.func,
    onExpand: PropTypes.func,
    onSelectRow: PropTypes.func,
    recording: PropTypes.object,
    selectedGroupedPageIdx: PropTypes.number
  };

  confirmDelete = () => {
    this.props.deleteRec(this.props.recording.get('id'));
  }

  expandCallback = () => {
    this.props.onExpand(this.props.recording);
  }

  render() {
    const { collection, browsers, expand, hasActivePage, onCollapse,
            onSelectRow, recording, selectedGroupedPageIdx } = this.props;
    const pageCount = recording.get('pages').size;

    const header = (
      <header className={classNames({ collapsible: pageCount > 0 })}>
        { pageCount > 0 && <span className="glyphicon glyphicon-triangle-right" />}
        <h2>{recording.get('title')}</h2>
        <span className="badge">{ recording.get('pages').size }</span>
        <RemoveWidget callback={this.confirmDelete} />
        <TimeFormat classes="session-ts" iso={recording.get('updated_at')} />
        <SizeFormat bytes={recording.get('size')} />
      </header>
    );

    return (
      <div className="wr-coll-session">
        <Collapsible
          lazyRender
          open={expand}
          transitionTime={Math.max(150, Math.min(700, pageCount * 60))}
          onOpen={this.expandCallback}
          onClose={onCollapse}
          easing="ease-out"
          trigger={header}>
          <PageList
            browsers={browsers}
            coll={collection}
            hasActivePage={hasActivePage}
            rec={recording}
            pages={recording.get('pages')}
            onSelectRow={onSelectRow}
            selectedGroupedPageIdx={selectedGroupedPageIdx} />
        </Collapsible>
      </div>
    );
  }
}

export default SessionCollapsible;
