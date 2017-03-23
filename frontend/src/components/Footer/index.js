import React from 'react';
import { Link } from 'react-router';

import { GithubIcon, HelpIcon, TwitterIcon } from 'components/Icons';

import './style.scss';

const logo = require('./rhizome_logo_sm.png');


function Footer(props) {
  return (
    <footer className="footer top-buffer">
      <div className="container top-buffer bottom-buffer">
        <div className="row">
          <div className="col-xs-12 col-sm-8 project-info">
            <Link to="/_faq">
              <HelpIcon />
            </Link>
            <Link to="https://github.com/webrecorder/webrecorder">
              <GithubIcon />
            </Link>
            <Link to="https://twitter.com/webrecorder_io">
              <TwitterIcon />
            </Link>
            <Link to="mailto:support@webrecorder.io" className="divider">Support</Link>
            <Link to="/_policies" className="divider">Terms and Policies</Link>
          </div>
          <div className="col-xs-6 col-xs-offset-3 col-sm-2 col-sm-offset-2 footer-label">
            <div>A Project By</div>
            <Link to="https://rhizome.org" target="_blank">
              <img className="rhizome-logo" src={logo} alt="rhizome.org logo" />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
