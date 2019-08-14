import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import { autopilot as autopilotFields } from 'helpers/userMessaging';

import { CheckIcon, LoaderIcon, WandIcon } from 'components/icons';

import './style.scss';


class AutopilotUI extends Component {
  static propTypes = {
    autopilot: PropTypes.bool,
    activeBrowser: PropTypes.string,
    autopilotInfo: PropTypes.object,
    autopilotReady: PropTypes.bool,
    autopilotReset: PropTypes.func,
    autopilotUrl: PropTypes.string,
    behavior: PropTypes.string,
    behaviorMessages: PropTypes.object,
    behaviorStats: PropTypes.object,
    browsers: PropTypes.object,
    checkAvailability: PropTypes.func,
    open: PropTypes.bool,
    status: PropTypes.string,
    toggleAutopilot: PropTypes.func,
    toggleSidebar: PropTypes.func,
    url: PropTypes.string,
    urlMethod: PropTypes.string
  };

  constructor(props) {
    super(props);

    this.state = {
      unsupported: false
    };
  }

  componentWillMount() {
    this.props.checkAvailability(this.props.url);
  }

  componentDidMount() {
    const { activeBrowser, browsers } = this.props;

    // reset status if complete
    if (this.props.status === 'complete' && this.props.url !== this.props.autopilotUrl) {
      this.props.autopilotReset();
    }

    if (
      (activeBrowser && !browsers.getIn([activeBrowser, 'caps']).includes('autopilot')) ||
      typeof Symbol.asyncIterator === 'undefined'
    ) {
      this.setState({ unsupported: true });
    }
  }

  componentDidUpdate(lastProps) {
    const { autopilotInfo } = this.props;
    if ((this.props.url !== lastProps.url) || this.props.activeBrowser !== lastProps.activeBrowser) {

      // if navigation always reset
      if (this.props.urlMethod == 'navigation') {
        this.props.autopilotReset();
        this.props.checkAvailability(this.props.url);
      } else if (this.props.status === 'new') {
      // if history change, update if 'new', otherwise do nothing
        this.props.checkAvailability(this.props.url);
      }
    }
  }

  componentWillUnmount() {
    this.props.autopilotReset();
  }

  toggleAutomation = () => {
    const { autopilotInfo, toggleAutopilot, status, url } = this.props;
    const behavior = autopilotInfo.get('name');

    if (behavior && ['new', 'running'].includes(status)) {
      toggleAutopilot(...(status === 'running' ? [null, 'stopping', url] : [behavior, 'running', url]));
    }
  }

  toggle = () => {
    this.props.toggleSidebar(!this.props.open);
  }

  render() {
    const { autopilot, autopilotInfo, autopilotReady, behaviorMessages, behaviorStats, status } = this.props;

    // only render if sidebar is open
    if (!autopilot) {
      return null;
    }

    const behavior = autopilotInfo;
    const isRunning = status === 'running';
    const isComplete = status === 'complete';
    const isStopping = status === 'stopping';
    const isStopped = status === 'stopped';

    const dt = behavior && new Date(behavior.get('updated'));
    const keyDomain = behavior && autopilotFields[behavior.get('name')];

    let buttonText;
    switch (status) {
      case 'new':
        buttonText = 'Start Autopilot';
        break;
      case 'running':
        buttonText = 'End Autopilot';
        break;
      case 'stopping':
        buttonText = 'Wait while behavior is stopping...';
        break;
      case 'stopped':
        buttonText = 'Autopilot Ended';
        break;
      case 'complete':
        buttonText = 'Autopilot Finished';
        break;
      default:
        buttonText = 'Start Autopilot';
    }

    return (
      <div className="autopilot-sidebar">
        <h4><WandIcon /> Autopilot</h4>
        {
          this.state.unsupported ?
            <React.Fragment>
              <h4>Not Supported for this Browser</h4>
              <p>To use autopilot, please select a different browser from the dropdown above. Only browsers with "autopilot" listed under capabilities support autopilot.</p>
            </React.Fragment> :
            <React.Fragment>
              <ul className={classNames('behaviors', { active: isRunning })}>
                {
                  behavior &&
                    <li key={behavior.get('name')}>
                      <div className="desc" id="opt1">
                        <div className="heading">{behavior.get('displayName') || behavior.get('name')}</div>
                        <div className="last-modified">
                          <em>{`Updated: ${dt.toLocaleDateString()} ${dt.toLocaleTimeString()}`}</em>
                        </div>
                        {behavior.get('description')}
                      </div>
                    </li>
                }
              </ul>

              {
                behaviorMessages.size > 0 &&
                  <ul className="behavior-log">
                    {
                      behaviorMessages.reverse().slice(0, 10).map(obj => <li>{obj.get('msg')}</li>)
                    }
                  </ul>
              }

              {
                !behaviorStats.isEmpty() && keyDomain &&
                  <div className="behaviorInfo">
                    <h4>Auto Captured Content:</h4>
                    <ul className="behaviorStats">
                      {
                        behaviorStats.entrySeq().map(([k, v]) => {
                          if (k in keyDomain) {
                            return <li key={k}>{`${keyDomain[k]}: ${v}`}</li>;
                          }
                          return null;
                        })
                      }
                    </ul>
                  </div>
              }

              <button className={classNames('rounded', { complete: isComplete })} onClick={this.toggleAutomation} disabled={!autopilotReady || isComplete || isStopping || isStopped} type="button">
                { (!autopilotReady || isRunning || isStopping) && <LoaderIcon /> }
                { isComplete && <CheckIcon /> }
                {
                  !autopilotReady ?
                    'page loading... please wait' :
                    buttonText
                }
              </button>
              {
                !isRunning && !isComplete &&
                  <div className="best-practices">
                    <h5>Best Practices</h5>
                    <p>
                      Learn more about how to achieve the best results when using Autopilot capture in <a href="https://guide.webrecorder.io/autopilot/#for-best-results" target="_blank">this user guide</a>
                    </p>
                  </div>
              }
              {
                isRunning &&
                  <div className="autopilot-message">End autopilot to resume manual interaction with page.</div>
              }
              {
                isComplete &&
                  <div className="autopilot-message">Manual capture has resumed.</div>
              }
            </React.Fragment>
        }
      </div>
    );
  }
}


export default AutopilotUI;
