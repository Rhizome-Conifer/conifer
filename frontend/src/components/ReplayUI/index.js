import React, { Component } from 'react';
import PropTypes from 'prop-types';

import { RecordingTools, ToolBin } from 'containers';

import ModeSelector from 'components/ModeSelector';
import ReplayURLBar from 'components/ReplayURLBar';
import SizeCounter from 'components/SizeCounter';

import './style.scss';


class ReplayUI extends Component {
  static propTypes = {
    bookmarks: PropTypes.object,
    params: PropTypes.object
  };

  static contextTypes = {
    currMode: PropTypes.string
  }

  render() {
    const { currMode } = this.context;
    const { params } = this.props;

    const isWrite = currMode === 'extract' || currMode === 'patch' || currMode === 'record';

    return (
      <div>
        <div role="presentation" className="container-fluid wr-controls navbar-default new-recording-ui">

          <ModeSelector />

          { isWrite &&
            <SizeCounter bytes={0} />
          }

          <ReplayURLBar {...this.props} />

          <RecordingTools params={params} />
        </div>

        <ToolBin />
      </div>
    );
  }
}

export default ReplayUI;
