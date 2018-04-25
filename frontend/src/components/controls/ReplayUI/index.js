import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'react-bootstrap';

import { ModeSelector, RecordingTools, SizeCounter, ToolBin } from 'containers';

import { ReplayURLBar, RecordURLBar } from 'components/controls';
import { InfoIcon } from 'components/icons';

import './style.scss';


class ReplayUI extends Component {
  static propTypes = {
    activeBrowser: PropTypes.string,
    params: PropTypes.object,
    sidebarExpanded: PropTypes.bool,
    timestamp: PropTypes.string,
    toggle: PropTypes.func,
    url: PropTypes.string
  };

  static contextTypes = {
    canAdmin: PropTypes.bool,
    currMode: PropTypes.string
  };

  toggleSidebar = () => {
    this.props.toggle(!this.props.sidebarExpanded);
  }

  render() {
    const { canAdmin, currMode } = this.context;
    const { params } = this.props;

    const isWrite = ['extract', 'extract_only', 'patch', 'record'].includes(currMode);

    return (
      <div>
        <div role="presentation" className="container-fluid wr-controls navbar-default new-recording-ui">

          {
            currMode.includes('replay') &&
              <Button onClick={this.toggleSidebar}>
                <InfoIcon />
              </Button>
          }

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
