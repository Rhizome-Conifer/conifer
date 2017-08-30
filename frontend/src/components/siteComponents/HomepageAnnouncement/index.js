import React from 'react';
import { Link } from 'react-router';

import './style.scss';

const logo = require('./logo.png');


function HomagepageAnnouncement() {
  return (
    <div className="row">
      <div id="news-alert" className="alert alert-info col-xs-8 col-xs-push-2 col-sm-6 col-sm-push-3" role="alert">
        <button type="button" className="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button>
        <div className="wr-alert-logo">
          <img src={logo} alt="Webrecorder logo" />
        </div>
        <div className="wr-alert-info">
          <h5><strong>New!</strong> Browse your archives offline with Webrecorder Desktop Player App</h5>
          <p>
            <Link to="https://github.com/webrecorder/webrecorderplayer-electron/releases/latest" target="_blank">Download the desktop app&nbsp;&raquo;</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default HomagepageAnnouncement;
