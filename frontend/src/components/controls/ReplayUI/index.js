import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Map } from 'immutable';

import { ModeSelector, RecordingTools, SizeCounter, ToolBin } from 'containers';

import { ReplayURLBar, RecordURLBar } from 'components/controls';

import './style.scss';


class ReplayUI extends Component {
  static propTypes = {
    activeBrowser: PropTypes.string,
    params: PropTypes.object,
    timestamp: PropTypes.string,
    url: PropTypes.string
  };

  static contextTypes = {
    canAdmin: PropTypes.bool,
    currMode: PropTypes.string
  };

  render() {
    const { canAdmin, currMode } = this.context;
    const { params } = this.props;

    const isWrite = ['extract', 'extract_only', 'patch', 'record'].includes(currMode);

    return (
      <div>
        <div role="presentation" className="container-fluid wr-controls navbar-default new-recording-ui">
          <ModeSelector params={params} />
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

        {
          canAdmin &&
            <ToolBin />
        }
      </div>
    );
  }
}

export default ReplayUI;
