import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import { CheckIcon, LoaderIcon, WandIcon, ThinXIcon } from 'components/icons';

import './style.scss';


class AutopilotUI extends Component {
  static propTypes = {
    activeBrowser: PropTypes.string,
    behavior: PropTypes.string,
    behaviorState: PropTypes.string,
    browsers: PropTypes.object,
    checkAvailability: PropTypes.func,
    autopilotInfo: PropTypes.object,
    autopilotUrl: PropTypes.string,
    open: PropTypes.bool,
    status: PropTypes.string,
    toggleAutopilot: PropTypes.func,
    toggleSidebar: PropTypes.func,
    url: PropTypes.string
  };

  constructor(props) {
    super(props);

    this.state = {
      behavior: 'autoScrollBehavior',
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
      this.props.toggleAutopilot(null, 'stopped');
    }

    if (
      (activeBrowser && !browsers.getIn([activeBrowser, 'caps']).includes('autopilot')) ||
      typeof Symbol.asyncIterator === 'undefined'
    ) {
      this.setState({ unsupported: true });
    }
  }

  componentDidUpdate(lastProps) {
    if (['stopped', 'complete'].includes(this.props.status) && this.props.url !== lastProps.url) {
      // reset status on url change
      if (this.props.status === 'complete') {
        this.props.toggleAutopilot(null, 'stopped');
      }

      this.props.checkAvailability(this.props.url);
    }

    if (this.props.autopilotInfo !== lastProps.autopilotInfo) {
      this.setState({ behavior: this.props.autopilotInfo.getIn([0, 'name']) });
    }
  }

  handleInput = (evt) => {
    this.setState({ behavior: evt.target.value });
  }

  selectMode = (mode) => {
    if (this.props.status !== 'running') {
      this.setState({ behavior: mode });
    }
  }

  toggleAutomation = () => {
    const { behavior } = this.state;
    const { toggleAutopilot, url } = this.props;
    if (behavior && this.props.status !== 'complete') {
      toggleAutopilot(...(this.props.behavior ? [null, 'stopped', url] : [behavior, 'running', url]));
    }
  }

  toggle = () => {
    this.props.toggleSidebar(!this.props.open);
  }

  render() {
    const { autopilotInfo, behaviorState, status } = this.props;
    const behaviors = autopilotInfo && autopilotInfo.size > 1 ? autopilotInfo.filter(b => !b.get('defaultBehavior')) : autopilotInfo;
    const isRunning = status === 'running';
    const isComplete = status === 'complete';

    return (
      <div className="autopilot-sidebar">
        <h2>Capture Options <button onClick={this.toggle} type="button"><ThinXIcon /></button></h2>
        {
          this.state.unsupported ?
            <React.Fragment>
              <h4>Not Supported for this Browser</h4>
              <p>To use autopilot, please select a different browser from the dropdown above. Only browsers with "autopilot" listed under capabilities support autopilot.</p>
            </React.Fragment> :
            <React.Fragment>
              <h4><WandIcon /> Autopilot</h4>
              <p>Capture the content on this page with a scripted behavior.</p>
              <ul className={classNames('behaviors', { active: isRunning })}>
                {
                  behaviors && behaviors.valueSeq().map((behavior) => {
                    const name = behavior.get('name');
                    const dt = new Date(behavior.get('updated'));
                    return (
                      <li onClick={this.selectMode.bind(this, name)} key={name}>
                        <input type="radio" name="behavior" value={name} disabled={isRunning || isComplete} aria-labelledby="opt1" onChange={this.handleInput} checked={this.state.behavior === name} />
                        <div className="desc" id="opt1">
                          <div className="heading">{name}</div>
                          <div className="last-modified">
                            <em>{`Updated: ${dt.toLocaleDateString()} ${dt.toLocaleTimeString()}`}</em>
                          </div>
                          {behavior.get('description')}
                        </div>
                      </li>
                    );
                  })
                }
              </ul>

              <button className={classNames('rounded', { complete: isComplete })} onClick={this.toggleAutomation} disabled={isComplete} type="button">
                { isRunning && <LoaderIcon /> }
                { isComplete && <CheckIcon /> }
                {
                  isComplete ?
                    'Autopilot Finished' :
                    `${isRunning ? 'Stop' : 'Start'} Autopilot`
                }
              </button>
              {
                isRunning &&
                  <em>Stop autopilot to resume manual interaction with page.</em>
              }
              {
                isComplete &&
                  <em>Autopilot actions have been completed. You may continue to capture the page manually. To run autopilot again, please refresh or load a new page.</em>
              }
              {
                behaviorState &&
                  <div className="behaviorInfo">
                    Last Action:
                    <div className="behaviorMsg">{ behaviorState.msg }</div>
                    <div className="behaviorStats">Stats
                      <ul>
                        {
                          behaviorState.state && Object.keys(behaviorState.state).map((stateProp) => {
                            return (
                              <li>{stateProp}: <em>{behaviorState.state[stateProp]}</em></li>
                            );
                          })
                        }
                      </ul>
                    </div>
                  </div>
              }
            </React.Fragment>
        }
      </div>
    );
  }
}


export default AutopilotUI;
