import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Dropdown, MenuItem } from 'react-bootstrap';

import { WandIcon, ThinXIcon } from 'components/icons';

import './style.scss';


class InpageAutomationUI extends Component {
  static propTypes = {
    browsers: PropTypes.object,
    open: PropTypes.bool,
    running: PropTypes.bool,
    selectedBrowser: PropTypes.string,
    selectRemoteBrowser: PropTypes.func,
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

  selectBrowser = (browser) => {
    this.props.selectRemoteBrowser(browser === 'native' ? null : browser);
  }

  selectMode = (mode) => {
    this.setState({ behavior: mode });
  }

  startAutomation = () => {
    const { behavior } = this.state;
    const { selectedBrowser } = this.props;
    if (behavior) {
      console.log(`start behavior ${behavior} with browser: ${selectedBrowser || 'native'}`);
    }
  }

  toggle = () => {
    this.props.toggleInpageAutomation(!this.props.open);
  }

  render() {
    const { browsers, selectedBrowser } = this.props;

    return (
      <div className="inpage-sidebar">
        <h2>Capture Options <button onClick={this.toggle} type="button"><ThinXIcon /></button></h2>
        <h4><WandIcon /> Autopilot</h4>
        <p>Capture the content on this page with a pre-scripted behavior running on a remote browser.</p>
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

        <div className="browser-selection">
          <label className="browser-label" htmlFor="inpage-browser">Capture Browser:</label>
          <Dropdown
            onSelect={this.selectBrowser}
            id="inpage-browser">
            {
              selectedBrowser ?
                <Dropdown.Toggle><img src={`/api/browsers/browsers/${selectedBrowser}/icon`} alt="Browser Icon" />{`${browsers.getIn([selectedBrowser, 'name'])} v${browsers.getIn([selectedBrowser, 'version'])}`}</Dropdown.Toggle> :
                <Dropdown.Toggle>Choose Browser</Dropdown.Toggle>
            }
            <Dropdown.Menu>
              <MenuItem eventKey="native">Current Browser</MenuItem>
              {
                browsers.valueSeq().map(browser => <MenuItem key={browser.get('id')} eventKey={browser.get('id')}><img src={`/api/browsers/browsers/${browser.get('id')}/icon`} alt="Browser Icon" />{`${browser.get('name')} v${browser.get('version')}`}</MenuItem>)
              }
            </Dropdown.Menu>
          </Dropdown>
        </div>

        <button className="rounded" onClick={this.startAutomation} type="button">Start Autopilot</button>
      </div>
    );
  }
}


export default InpageAutomationUI;
