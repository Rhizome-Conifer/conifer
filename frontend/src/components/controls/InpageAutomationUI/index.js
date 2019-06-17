import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import { LoaderIcon, WandIcon, ThinXIcon } from 'components/icons';

import './style.scss';


class InpageAutomationUI extends Component {
  static propTypes = {
    activeBrowser: PropTypes.string,
    behavior: PropTypes.string,
    browsers: PropTypes.object,
    checkAvailability: PropTypes.func,
    inpageInfo: PropTypes.object,
    open: PropTypes.bool,
    running: PropTypes.bool,
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

    if (typeof Symbol.asyncIterator === 'undefined') {
      // check if remote browser is active and supports autopilot
      if (activeBrowser && browsers.getIn([activeBrowser, 'inpage'])) {
        return;
      }

      this.setState({ unsupported: true });
    }
  }

  componentDidUpdate(lastProps) {
    if (!this.props.running && this.props.url !== lastProps.url) {
      this.props.checkAvailability(this.props.url);
    }
  }

  handleInput = (evt) => {
    this.setState({ behavior: evt.target.value });
  }

  selectMode = (mode) => {
    if (!this.props.running) {
      this.setState({ behavior: mode });
    }
  }

  startAutomation = () => {
    const { behavior } = this.state;
    if (behavior) {
      this.props.toggleInpageAutomation(this.props.behavior ? null : behavior);
    }
  }

  toggle = () => {
    this.props.toggleSidebar(!this.props.open);
  }

  render() {
    const { inpageInfo, running } = this.props;
    const behaviors = inpageInfo && inpageInfo.filter(b => !b.get('defaultBehavior'));

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
              <ul className={classNames('behaviors', { active: running })}>
                {
                  behaviors && behaviors.valueSeq().map((behavior) => {
                    const name = behavior.get('name');
                    return (
                      <li onClick={this.selectMode.bind(this, name)} key={name}>
                        <input type="radio" name="behavior" value={name} disabled={running} aria-labelledby="opt1" onChange={this.handleInput} checked={this.state.behavior === name} />
                        <div className="desc" id="opt1">
                          <div className="heading">{name}</div>
                          {behavior.get('description')}
                        </div>
                      </li>
                    );
                  })
                }

                <li onClick={this.selectMode.bind(this, 'autoScrollBehavior')} key="autoscroll">
                  <input type="radio" name="behavior" value="autoScrollBehavior" disabled={running} aria-labelledby="opt2" onChange={this.handleInput} checked={this.state.behavior === 'autoScrollBehavior'} />
                  <div className="desc" id="opt2">
                    <div className="heading">AutoScroll</div>
                    Automatially scroll to the bottom of the page. If more content loads, scrolling will continue until stopped by user.
                  </div>
                </li>
              </ul>

              <button className="rounded" onClick={this.startAutomation} type="button">
                { running && <LoaderIcon /> }
                { running ? 'Stop' : 'Start'} Autopilot
              </button>
              {
                running &&
                  <em>The page will be noninteractive while autopilot is running</em>
              }
            </React.Fragment>
        }
      </div>
    );
  }
}


export default InpageAutomationUI;
