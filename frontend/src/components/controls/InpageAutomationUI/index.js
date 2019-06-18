import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import { CheckIcon, LoaderIcon, WandIcon, ThinXIcon } from 'components/icons';

import './style.scss';


class InpageAutomationUI extends Component {
  static propTypes = {
    activeBrowser: PropTypes.string,
    behavior: PropTypes.string,
    browsers: PropTypes.object,
    checkAvailability: PropTypes.func,
    inpageInfo: PropTypes.object,
    inpageUrl: PropTypes.string,
    open: PropTypes.bool,
    status: PropTypes.string,
    toggleInpageAutomation: PropTypes.func,
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
    if (this.props.status === 'complete' && this.props.url !== this.props.inpageUrl) {
      this.props.toggleInpageAutomation(null, 'stopped');
    }

    if (typeof Symbol.asyncIterator === 'undefined') {
      // check if remote browser is active and supports autopilot
      if (activeBrowser && browsers.getIn([activeBrowser, 'inpage'])) {
        return;
      }

      this.setState({ unsupported: true });
    }
  }

  componentDidUpdate(lastProps) {
    if (['stopped', 'complete'].includes(this.props.status) && this.props.url !== lastProps.url) {
      // reset status on url change
      if (this.props.status === 'complete') {
        this.props.toggleInpageAutomation(null, 'stopped');
      }

      this.props.checkAvailability(this.props.url);
    }

    if (this.props.inpageInfo !== lastProps.inpageInfo) {
      this.setState({ behavior: this.props.inpageInfo.getIn([0, 'name']) });
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
    const { toggleInpageAutomation, url } = this.props;
    if (behavior && this.props.status !== 'complete') {
      toggleInpageAutomation(...(this.props.behavior ? [null, 'stopped', url] : [behavior, 'running', url]));
    }
  }

  toggle = () => {
    this.props.toggleSidebar(!this.props.open);
  }

  render() {
    const { inpageInfo, status } = this.props;
    const behaviors = inpageInfo && inpageInfo.filter(b => !b.get('defaultBehavior'));
    const isRunning = status === 'running';
    const isComplete = status === 'complete';

    return (
      <div className="inpage-sidebar">
        <h2>Capture Options <button onClick={this.toggle} type="button"><ThinXIcon /></button></h2>
        {
          this.state.unsupported ?
            <React.Fragment>
              <h4>Not Supported for this Browser</h4>
              <p>To use autopilot, please select a different browser from the dropdown above. Only browsers with a wand icon support autopilot.</p>
            </React.Fragment> :
            <React.Fragment>
              <h4><WandIcon /> Autopilot</h4>
              <p>Capture the content on this page with a scripted behavior.</p>
              <ul className={classNames('behaviors', { active: isRunning })}>
                {
                  behaviors && behaviors.valueSeq().map((behavior) => {
                    const name = behavior.get('name');
                    return (
                      <li onClick={this.selectMode.bind(this, name)} key={name}>
                        <input type="radio" name="behavior" value={name} disabled={isRunning || isComplete} aria-labelledby="opt1" onChange={this.handleInput} checked={this.state.behavior === name} />
                        <div className="desc" id="opt1">
                          <div className="heading">{name}</div>
                          {behavior.get('description')}
                        </div>
                      </li>
                    );
                  })
                }

                <li onClick={this.selectMode.bind(this, 'autoScrollBehavior')} key="autoscroll">
                  <input type="radio" name="behavior" value="autoScrollBehavior" disabled={isRunning || isComplete} aria-labelledby="opt2" onChange={this.handleInput} checked={this.state.behavior === 'autoScrollBehavior'} />
                  <div className="desc" id="opt2">
                    <div className="heading">AutoScroll</div>
                    Automatially scroll to the bottom of the page. If more content loads, scrolling will continue until stopped by user.
                  </div>
                </li>
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
                  <em>The page will be noninteractive while autopilot is running</em>
              }
            </React.Fragment>
        }
      </div>
    );
  }
}


export default InpageAutomationUI;
