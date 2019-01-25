import React from 'react';
import { Link } from 'react-router-dom';

import { announceMailingList, supportEmail } from 'config';

import { GithubIcon, MailIcon, TwitterIcon } from 'components/icons';

import './style.scss';

const logo = require('./rhizome_logo_sm.png');


function Footer() {
  return (
    <footer className="footer top-buffer">
      <div className="container top-buffer bottom-buffer">
        <div className="row">
          <div className="col-xs-12 col-sm-8 project-info">
            <a href="https://github.com/webrecorder/webrecorder" aria-label="Github" target="_blank">
              <GithubIcon />
            </a>
            <a href="https://twitter.com/webrecorder_io" aria-label="Twitter" target="_blank">
              <TwitterIcon />
            </a>
            <a href={`mailto:${supportEmail}`} className="divider contact"><MailIcon />Contact</a>
            <Link to="/_faq" className="divider">About</Link>
            <a href="https://guide.webrecorder.io/" target="_blank" className="divider">User Guide</a>
            <a href="https://blog.webrecorder.io" target="_blank" className="divider">Blog</a>
            <Link to="/_policies" className="divider">Terms & Policies</Link>
          </div>
          <div className="col-xs-6 col-xs-offset-3 col-sm-2 col-sm-offset-2 footer-label">
            <div>A Project By</div>
            <a href="https://rhizome.org" target="_blank">
              <img className="rhizome-logo" src={logo} alt="rhizome.org logo" />
            </a>
          </div>
        </div>
        {
          announceMailingList &&
            <div className="row hidden-xs">
              <div className="col-xs-12">
                <form method="post" id="email-signup" className="navbar-form mc-embedded-subscribe-form" action={announceMailingList}>
                  <div className="form-group-sm">
                    <input type="email" name="EMAIL" className="form-control" placeholder="your@email.com" />
                    <button type="submit" className="btn btn-default btn-sm">Get Updates</button>
                  </div>
                  <div style={{ position: 'absolute', left: '-5000px' }} aria-hidden="true">
                    <input type="text" name="b_a1487b13ca8ed17d052f71f12_7f979630a1" tabIndex="-1" defaultValue="" />
                  </div>
                </form>
              </div>
            </div>
        }
      </div>
    </footer>
  );
}

export default Footer;
