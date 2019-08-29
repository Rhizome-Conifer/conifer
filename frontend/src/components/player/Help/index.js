import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import { appendFlashVersion } from 'helpers/utils';

import './style.scss';

const { ipcRenderer } = window.require('electron');


class Help extends Component {

  static propTypes = {
    version: PropTypes.object
  }

  constructor(props) {
    super(props);

    this.state = {
      version: null,
      stdout: null,
      showDebug: true,
      debugHeight: null,
    };
  }

  componentWillMount() {
    ipcRenderer.on('async-response', this.handleVersionResponse);
    ipcRenderer.send('async-call');
  }

  componentWillUnmount() {
    ipcRenderer.removeListener('async-response', this.handleVersionResponse);
  }

  handleVersionResponse = (evt, arg) => {
    const { version } = arg.config;
    const { stdout } = arg;

    this.setState({ version: appendFlashVersion(version), stdout });

    setTimeout(this.update, 100);
  }

  toggleDebug = () => {
    this.setState({ showDebug: !this.state.showDebug });
  }

  update = () => {
    this.setState({ debugHeight: this.debugBin.getBoundingClientRect().height, showDebug: false });
  }

  render() {
    const { debugHeight, showDebug, stdout, version } = this.state;

    return (
      <div className="help-container" key="help">
        <div className="help">
          <h5>What are Web Archives?</h5>
          <p>A web archive is a record of web resources. It may include HTML and images, scripts, stylesheets, as well as video, audio and other elements that web pages and web apps are made of, all in one file. </p>
          <p>Webrecorder Player currently supports browsing web archives in the following formats:</p>
          <ul>
            <li><a href="https://en.wikipedia.org/wiki/Web_ARChive" target="_blank">WARC format</a> (<b>.warc, warc.gz</b>)<small>&mdash; the most commonly used one</small></li>
            <li><a href="https://en.wikipedia.org/wiki/.har" target="_blank">HAR format</a> (<b>.har</b>)</li>
            <li><a href="http://archive.org/web/researcher/ArcFileFormat.php" target="_blank">ARC format</a> (<b>.arc</b>, <b>.arc.gz</b>)</li>
          </ul>


          <h5>How do I Create Web Archives?</h5>
          <p>You can use free service <a href="https://webrecorder.io" target="_blank">https://webrecorder.io</a> to create, view, share and save your web archives online. <a href="https://www.youtube.com/watch?v=n3SqusABXEk&feature=youtu.be" target="_blank">View video tutorial »</a></p>

          <p>To view your web archives offline, you can download them from <a href="https://webrecorder.io" target="_blank">https://webrecorder.io</a> and use this app to browse your archives.</p>

          <h5>How is this better than “Save As” in my browser?</h5>
          <p>Most modern web sites (especially social media sites) use complicated scripting and load resources only when the user is triggering certain actions. This can not be represented as files, while web archives were designed to handle the task.</p>

          <h5>How is this better than taking screen shots of my browser?</h5>
          <p>Screenshots are great, yet a web archive can provide much more context that reveals itself in interaction only.</p>

          <h5>Contact</h5><p><a href="mailto:support@webrecorder.io">  support@webrecorder.io</a></p>

          <h5>Version Info</h5>
          <p id="stack-version" dangerouslySetInnerHTML={{ __html: version || 'Loading...' }} />
          <h5 className="debug-heading">Additional Debug Info</h5>
          <button className="debug-toggle" onClick={this.toggleDebug}>{ showDebug ? 'collapse' : 'expand' }</button>
          <div
            className={classNames('stdout-debug', { open: showDebug })}
            ref={(obj) => { this.debugBin = obj; }}
            style={isNaN(debugHeight) ? {} : { height: showDebug ? debugHeight : 0 }}>
            <p dangerouslySetInnerHTML={{ __html: stdout || 'No additional info' }} />
          </div>
          <div className="support">
            <hr />
            <p>Major support for the Webrecorder initiative is provided by <a href="https://mellon.org/grants/grants-database/grants/rhizome-communications-inc/41500666/" target="_blank">The Andrew W. Mellon Foundation.</a></p>
            <p>Outreach, events, and research around Webrecorder is supported by <a href="http://www.knightfoundation.org/press/releases/three-projects-will-help-better-inform-the-public-through-technology-innovation-with-540-000-from-knight-foundation" target="_blank">James S. and John L. Knight Foundation</a>.</p>
            <p>Additional support for Rhizome digital preservation is provided by Google and the Google Cultural Institute, the National Endowment for the Arts, and the New York State Council on the Arts with the support of Governor Andrew Cuomo and the New York State Legislature.</p>
          </div>
        </div>
      </div>
    );
  }
}

export default Help;
