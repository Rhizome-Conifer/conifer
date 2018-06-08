import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';
import { connect } from 'react-redux';

import { homepageAnnouncement, supportEmail } from 'config';

import { showModal } from 'store/modules/userLogin';

import { HomepageAnnouncement, HomepageMessage } from 'components/siteComponents';
import { StandaloneRecorder } from 'containers';

import './style.scss';


class Home extends Component {

  static propTypes = {
    auth: PropTypes.object,
    collections: PropTypes.array,
    showModalCB: PropTypes.func,
  };

  shouldComponentUpdate(nextProps) {
    if (this.props.auth.get('loading')) {
      return false;
    }

    return true;
  }

  render() {
    const { auth, showModalCB } = this.props;
    const user = auth.get('user');

    return (
      <React.Fragment>
        <Helmet>
          <title>Homepage</title>
        </Helmet>
        <div className="row top-buffer main-logo">
          <h1>Webrecorder</h1>
        </div>
        <div className="row tagline">
          <h4 className="text-center">Collect & Revisit the Web</h4>
        </div>
        {
          user.get('anon') && user.get('num_collections') > 0 &&
            <HomepageMessage
              auth={auth}
              showModal={showModalCB} />
        }
        <div className="row top-buffer-lg bottom-buffer-lg">
          <StandaloneRecorder />
        </div>
        {
          homepageAnnouncement &&
            <HomepageAnnouncement />
        }

        <div className="row intro-blurb">
          <div className="col-sm-8 col-sm-offset-2">
            <h6>Our Mission</h6>
            <h2>Web Archiving for All!</h2>
            <p>Webrecorder is a web archiving service anyone can use for free to save web pages. Making a capture is as easy as browsing a page like you normally would. Webrecorder automatically archives the page, along with any additional content triggered by interactions.</p>
            <p>This open-source project is brought to you by <a href="http://rhizome.org/" target="_blank">Rhizome</a> at the <a href="http://www.newmuseum.org/" target="_blank">New Museum</a>.</p>
            <p>The <a href="https://mellon.org/grants/grants-database/grants/rhizome-communications-inc/41500666/" target="_blank">Andrew W. Mellon Foundation</a> is lead supporter of the Webrecorder initiative. Additional outreach and research is made possible by the <a href="https://www.knightfoundation.org/press/releases/three-projects-will-help-better-inform-the-public-through-technology-innovation-with-540-000-from-knight-foundation" target="_blank">Knight Foundation</a> and the Institute of Museum and Library Services.</p>
          </div>
        </div>

        {/*  Online Forever */}
        <div className="row landing-info">
          <div>
            <div className="col-sm-6 hidden-xs">
              <img src={require('shared/images/homepage/link.png')} className="center-block" alt="Online Now ≠ Online Forever" />
            </div>
            <div className="col-sm-6">
              <h3>Online Now ≠ Online Tomorrow</h3>
              <p>Links break. Services disappear and redesigns happen. The web is ephemeral. Make sure that what’s important to you will stay available.</p>
            </div>
          </div>
        </div>

        {/*  Your Data */}
        <div className="row landing-info">
          <div>
            <div className="col-sm-6">
              <h3>Your web, your data</h3>
              <ul>
                <li>Capture websites as a logged in user, then share archived pages without revealing your credentials.</li>
                <li>Make your collections publicly accessible or keep them private.</li>
                <li>All the web archives you create are downloadable in the ISO standard WARC file format.</li>
              </ul>
            </div>
            <div className="col-sm-6 hidden-xs">
              <img src={require('shared/images/homepage/login.png')} className="center-block" alt="Your web, your data." />
            </div>
          </div>
        </div>

        {/* For Web Media */}
        <div className="row table landing-info">
          <div>
            <div className="col-sm-6 hidden-xs">
              <img src={require('shared/images/homepage/belljar.png')} className="center-block" alt="Web Preservation for Web Media" />
            </div>
            <div className="col-sm-6">
              <h3>Web Preservation for Web Media </h3>
              <p>Web archives are more than screenshots: they are interactive, contain different types of media and link to other resources. The way Webrecorder captures web media ensures page performance is preserved and replicable in the future.</p>
              <p>And even if technologies like Flash, or your favorite browser, become obsolete in 5 years, Webrecorder’s emulation options allow pages to be browsed using the same technologies they were captured on.</p>
            </div>
          </div>
        </div>

        {/*  Offline Viewing */}
        <div className="row landing-info">
          <div>
            <div className="col-sm-6">
              <h3>Offline Browsing</h3>
              <p>Webrecorder also provides <a href="https://github.com/webrecorder/webrecorderplayer-electron/releases/latest" target="_blank">Webrecorder Player</a>, a desktop application for Windows, OSX and Linux, so you can open the exported web archives even when you are offline.</p>
            </div>
            <div className="col-sm-6 hidden-xs">
              <img src={require('shared/images/homepage/sparkle_browser.png')} className="center-block" alt="View Offline!" />
            </div>
          </div>
        </div>

        {/* What's the Magic? */}
        <div className="row landing-info">
          <div>
            <div className="col-sm-6 hidden-xs">
              <img src={require('shared/images/homepage/magic_browsers.png')} className="center-block" alt="View Offline!" />
            </div>
          </div>
          <div className="col-sm-6">
            <h3>What's the Magic?</h3>
            <h4>(or How does it all work?)</h4>
            <p>Webrecorder takes a new approach to web archiving by “recording” network traffic and processes within the browser while the user interacts with a web page. Unlike conventional crawl-based web archiving methods, this allows even intricate websites, such as those with embedded media, complex Javascript, user-specific content and interactions, and other dynamic elements, to be captured and faithfully restaged.</p>
            <p><small>We're working on a more detailed explanation of how it all works. For now, email us at <a href={`mailto:${supportEmail}`} target="_blank">{supportEmail}</a> if you have any questions. </small></p>
          </div>
        </div>
      </React.Fragment>
    );
  }
}

const mapStateToProps = ({ app }) => {
  return {
    auth: app.get('auth')
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    showModalCB: b => dispatch(showModal(b))
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(Home);
