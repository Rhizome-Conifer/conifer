import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Map } from 'immutable';

import { ModeSelector, RecordingTools, SizeCounter, ToolBin } from 'containers';

import { ReplayURLBar, RecordURLBar } from 'components/controls';

import './style.scss';


class ReplayUI extends Component {
  static propTypes = {
    activeCollection: PropTypes.object,
    bookmarks: PropTypes.object,
    params: PropTypes.object,
    timestamp: PropTypes.string,
    url: PropTypes.string
  };

  static defaultProps = {
    bookmarks: Map(),
  };

  static contextTypes = {
    currMode: PropTypes.string
  };

  render() {
    const { currMode } = this.context;
    const { params, timestamp, url } = this.props;

    const isWrite = ['extract', 'extract_only', 'patch', 'record'].includes(currMode);

    return (
      <div>
        <div role="presentation" className="container-fluid wr-controls navbar-default new-recording-ui">
          <ModeSelector
            params={params}
            ts={timestamp}
            url={url} />

          {
            isWrite &&
              <SizeCounter bytes={0} />
          }

          {
            isWrite ?
              <RecordURLBar {...this.props} /> :
              <ReplayURLBar {...this.props} />
          }

          <RecordingTools params={params} />
        </div>

        <ToolBin />
      </div>
    );
  }
}

export default ReplayUI;
