import React, { Component } from 'react';
import PropTypes from 'prop-types';

import ModeSelector from 'components/ModeSelector';
import RecordingTools from 'components/RecordingTools';
import ReplayURLBar from 'components/ReplayURLBar';
import SizeCounter from 'components/SizeCounter';

import './style.scss';


class ReplayUI extends Component {
  static propTypes = {
    recordings: PropTypes.object,
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
      <div
        role="presentation"
        className="container-fluid wr-controls navbar-default new-recording-ui">
        <ModeSelector />

        { isWrite &&
          <SizeCounter bytes={0} />
        }

        <ReplayURLBar {...this.props} />

        <RecordingTools params={params} />
      </div>
    );
  }
}

export default ReplayUI;
