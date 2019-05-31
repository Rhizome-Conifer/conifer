import React, { Component } from 'react';
import PropTypes from 'prop-types';

import { WandIcon, ThinXIcon } from 'components/icons';

import './style.scss';


class InpageAutomationUI extends Component {
  static propTypes = {
    open: PropTypes.bool,
    running: PropTypes.bool,
    toggleInpageAutomation: PropTypes.func
  };

  constructor(props) {
    super(props);

    this.state = {
      behavior: 'default'
    };
  }

  handleInput = (evt) => {
    this.setState({ behavior: evt.target.value });
  }

  selectMode = (mode) => {
    this.setState({ behavior: mode });
  }

  startAutomation = () => {
    const { behavior } = this.state;
    if (behavior) {
      console.log(`start behavior ${behavior}`);
    }
  }

  toggle = () => {
    this.props.toggleInpageAutomation(!this.props.open);
  }

  render() {
    return (
      <div className="inpage-sidebar">
        <h2>Capture Options <button onClick={this.toggle} type="button"><ThinXIcon /></button></h2>
        <h4><WandIcon /> Autopilot</h4>
        <p>Capture the content on this page with a scripted behavior.</p>
        <ul className="behaviors">
          <li onClick={this.selectMode.bind(this, 'default')}>
            <input type="radio" name="behavior" value="default" aria-labelledby="opt1" onChange={this.handleInput} checked={this.state.behavior === 'default'} />
            <div className="desc" id="opt1">
              <div className="heading">Default Behavior</div>
              Comprehensively capture items on the current page with behviors we've written for it
            </div>
          </li>

          <li onClick={this.selectMode.bind(this, 'autoscroll')}>
            <input type="radio" name="behavior" value="autoscroll" aria-labelledby="opt2" onChange={this.handleInput} checked={this.state.behavior === 'autoscroll'} />
            <div className="desc" id="opt2">
              <div className="heading">AutoScroll</div>
              Automatially scroll to the bottom of the page. If more content loads, scrolling will continue until stopped by user.
            </div>
          </li>
        </ul>

        <button className="rounded" onClick={this.startAutomation} type="button">Start Autopilot</button>
      </div>
    );
  }
}


export default InpageAutomationUI;
