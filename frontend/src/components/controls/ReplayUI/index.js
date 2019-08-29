import React, { Component } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { Button } from 'react-bootstrap';

import { ModeSelector, RecordingTools } from 'containers';

import { ReplayURLBar, RecordURLBar } from 'components/controls';
import { InfoIcon, PlayerArrowLeftIcon, PlayerArrowRightIcon, RefreshIcon } from 'components/icons';

import './style.scss';


class ReplayUI extends Component {
  static propTypes = {
    activeBrowser: PropTypes.string,
    autopilotRunning: PropTypes.bool,
    canGoBackward: PropTypes.bool,
    canGoForward: PropTypes.bool,
    params: PropTypes.object,
    sidebarExpanded: PropTypes.bool,
    timestamp: PropTypes.string,
    toggle: PropTypes.func,
    url: PropTypes.string
  };

  static contextTypes = {
    canAdmin: PropTypes.bool,
    currMode: PropTypes.string,
    isMobile: PropTypes.bool
  };

  toggleSidebar = () => {
    this.props.toggle(!this.props.sidebarExpanded);
  }

  triggerBack = () => {
    const { canGoBackward } = this.props;

    if (canGoBackward) {
      window.dispatchEvent(new Event('wr-go-back'));
    }
  }

  triggerForward = () => {
    const { canGoForward } = this.props;

    if (canGoForward) {
      window.dispatchEvent(new Event('wr-go-forward'));
    }
  }

  triggerRefresh = () => {
    window.dispatchEvent(new Event('wr-refresh'));
  }

  render() {
    const { canAdmin, currMode, isMobile } = this.context;
    const { canGoBackward, canGoForward } = this.props;

    const isWrite = ['extract', 'extract_only', 'patch', 'record', 'live'].includes(currMode);

    let backClass;
    let fwdClass;
    let refreshClass;

    if (__DESKTOP__) {
      backClass = classNames('arrow', {
        inactive: !canGoBackward
      });
      fwdClass = classNames('arrow', {
        inactive: !canGoForward
      });
      refreshClass = classNames('arrow', {
        inactive: false
      });
    }

    return (
      <div role="presentation" className={classNames('container-fluid wr-controls navbar-default', { 'has-widget': ['extract', 'extract_only', 'patch'].includes(currMode) })}>
        {
          currMode.includes('replay') && !isMobile &&
            <Button className="sidebar-toggle" onClick={this.toggleSidebar}>
              <InfoIcon />
            </Button>
        }

        {
          canAdmin && !isMobile &&
            <ModeSelector />
        }

        {
          __DESKTOP__ &&
            <div className="browser-nav">
              <button onClick={this.triggerBack} disabled={!canGoBackward} className={backClass} title="Click to go back" aria-label="navigate back" type="button">
                <PlayerArrowLeftIcon />
              </button>
              <button onClick={this.triggerForward} disabled={!canGoForward} className={fwdClass} title="Click to go forward" aria-label="navigate forward" type="button">
                <PlayerArrowRightIcon />
              </button>
              <button onClick={this.triggerRefresh} disabled={false} className={refreshClass} title="Refresh inner window" aria-label="Refresh inner window" type="button">
                <RefreshIcon />
              </button>
            </div>
        }

        {
          isWrite ?
            <RecordURLBar {...this.props} /> :
            <ReplayURLBar {...this.props} />
        }

        {
          !isMobile && !__PLAYER__ &&
            <RecordingTools />
        }
      </div>
    );
  }
}

export default ReplayUI;
