import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';

import { anonDisabled, homepageAnnouncement, supporterPortal } from 'config';

import { StandaloneRecorder } from 'containers';
import RedirectWithStatus from 'components/RedirectWithStatus';
import { HomepageAnnouncement, HomepageMessage } from 'components/siteComponents';


import './style.scss';


class HomeUI extends PureComponent {

  static propTypes = {
    auth: PropTypes.object,
    collections: PropTypes.array,
    history: PropTypes.object,
    showModalCB: PropTypes.func,
  };

  goToSupporterSite = () => {
    window.location.href = supporterPortal;
  }

  desktopApp = () => {
    window.location.href = 'https://github.com/webrecorder/webrecorder-desktop/releases/latest';
  }

  github = () => {
    window.location.href = 'https://github.com/webrecorder/';
  }

  login = () => {
    this.props.showModalCB();
  }

  playerApp = () => {
    window.location.href = 'https://github.com/webrecorder/webrecorder-player/releases/latest';
  }

  signup = () => {
    this.props.history.push('/_register');
  }

  render() {
    const { auth, showModalCB } = this.props;
    const user = auth.get('user');

    if (__DESKTOP__ || !user.get('anon')) {
      return <RedirectWithStatus to={`/${user.get('username')}`} status={302} />;
    }

    return (
      <React.Fragment>
        <Helmet>
          <title>Homepage</title>
        </Helmet>

        {
          !anonDisabled &&
          <div className="top-buffer">
            <StandaloneRecorder />
            <div className="top-buffer">
              {
                user.get('anon') && user.get('num_collections') > 0 &&
                  <HomepageMessage
                    auth={auth}
                    showModal={showModalCB} />
              }
            </div>
          </div>
        }

        <div className="keystone">
          <figure>
            <a href="https://webrecorder.io/pelicanbomb/pelican-bomb">
              <img src={require('shared/images/homepage/keystone-figure.png')} alt="Screenshots of Webrecorder.io" />
            </a>
          </figure>
          <div className="intro">
            <h2>Webrecorder.io is a web archiving service to collect and revisit web pages.</h2>
            <p>Webrecorder creates an interactive copy of any web page that you browse, including content revealed by your interactions such as playing video and audio, scrolling, clicking buttons, and so forth.</p>

            <div className="cta">
              <button className="rounded btn-primary" onClick={this.signup} type="button">Create a Free Account</button>
              <button className="button-link" onClick={this.login} type="button">Existing Users Login</button>
            </div>

            { supporterPortal && <div className="note">Webrecorder.io offers free accounts with 5GB of storage. Get more and contribute to Webrecorder's development by <a href={supporterPortal} target="_blank">becoming a supporter</a>.</div> }

            <div className="note">Don't want to register? <a href="https://github.com/webrecorder/webrecorder-desktop/releases/latest">Download Desktop App</a> to collect and access archived web pages on your own computer, no account necessary.</div>

            {
              homepageAnnouncement &&
                <HomepageAnnouncement />
            }
          </div>
        </div>

        <section className="row landing-info">
          <div>
            <div className="col-sm-6">
              <h3>Online Now ≠ Online Tomorrow</h3>
              <p>Links break. Information is removed from the web. Services disappear and redesigns happen. Make sure that what’s important to you will stay available.</p>
            </div>
            <div className="col-sm-6 hidden-xs">
              <img src={require('shared/images/homepage/link.png')} className="center-block" alt="Online Now ≠ Online Forever" />
            </div>
          </div>
        </section>

        {/* For Web Media */}
        <section className="row landing-info">
          <div>
            <div className="col-sm-6">
              <h3>Capture Complex Webpages</h3>
              <p>Webrecorder takes a new approach to web archiving by capturing ("recording") network traffic and processes within the browser while you interact with a web page. Unlike conventional crawler-based web archiving methods, this allows even intricate websites, such as those with embedded media, complex Javascript, user-specific content and interactions, and other dynamic elements, to be captured and faithfully restaged.</p>
            </div>
            <div className="col-sm-6 hidden-xs">
              <img src={require('shared/images/homepage/belljar.png')} className="center-block" alt="Web Preservation for Web Media" />
            </div>
          </div>
        </section>

        {/* autopilot */}
        <section className="row landing-info">
          <div>
            <div className="col-sm-6">
              <h3>Autopilot Your Captures</h3>
              <p>Capturing pages on a popular web platform? Autopilot behaviors may be able to speed up your capture via automation.</p>
            </div>
            <div className="col-sm-6 hidden-xs">
              <figure>
                {
                  !__DESKTOP__ &&
                    <video autoPlay loop muted poster={require('shared/images/homepage/autopilot.jpg')}>
                      <source src={require('shared/media/autopilot.mp4')} type="video/mp4" />
                      <source src={require('shared/media/autopilot.webm')} type="video/webm" />
                      <source src={require('shared/media/autopilot.ogv')} type="video/ogg" />
                    </video>
                }
              </figure>
            </div>
          </div>
        </section>

        <section className="advanced-features">
          <div className="col-xs-8 col-xs-offset-2">
            <h3>Advanced Features</h3>
            <dl>
              <dt>Login and Capture</dt>
              <dd>Capture what you see on websites when you're logged into them, and share archived pages without revealing your credentials.</dd>

              <dt>Publish and Share</dt>
              <dd>Make your collections publicly accessible or keep them private.</dd>

              <dt>Own Your Data</dt>
              <dd>Download your web archives in the ISO standard WARC file format.</dd>

              <dt>Pre-configured browsers for best capturing results</dt>
              <dd>Webrecorder's Remote Browser feature provides access to a range of preconfigured browsers running on the Webrecorder server. They offer for the most thorough capture of network traffic, and support for Flash.</dd>
            </dl>
          </div>
        </section>

        <section className="supporter">
          <header>
            <h1>You can support free, open source tools for archiving the web.</h1>
          </header>

          <div className="oss-intro">
            <h2>The Webrecorder project is an open source initiative by Rhizome at the New Museum. Our mission is to make high-fidelity web archiving accessible to all.</h2>
            <p>Here are some other tools we have developed. An extensive lists of re-usable software components produced by Webrecorder is available here.</p>
          </div>

          {
            supporterPortal &&
              <div className="supportCTA">
                <h3>You can support free, open source tools for archiving the web.</h3>
                <button className="rounded" onClick={this.goToSupporterSite} type="button">Become a Supporter</button>
                <a href="https://supporter.webrecorder.io" target="_blank">Learn more</a>
                <p>Webrecorder is a project of Rhizome, a registered 501(c)(3) non-profit organization. Your donations are tax-deductible.</p>
              </div>
          }

          <div>
            <img src={require('shared/images/homepage/desktop.png')} alt="Desktop Logo" />
            <h4>Webrecorder Desktop App</h4>
            <p>Create, manage, and store web archives on your local computer.</p>
            <button className="rounded" onClick={this.desktopApp} type="button">Download Desktop App</button>
          </div>

          <div>
            <img src={require('shared/images/homepage/player.png')} alt="Player Logo" />
            <h4>Webrecorder Player App</h4>
            <p>Use this desktop web archive viewer to browse exported collections, even when you are offline.</p>
            <button className="rounded" onClick={this.playerApp} type="button">Download Player App</button>
          </div>

          <div>
            <img src={require('shared/images/homepage/oss.png')} alt="Group of open source software logos" />
            <h4>Other Software Components</h4>
            <p>Webrecorder produces a range of re-usable open source software components for web archiving, all of which are available on GitHub.</p>
            <button className="rounded" onClick={this.github} type="button">Visit Our Github</button>
          </div>
        </section>
      </React.Fragment>
    );
  }
}


export default HomeUI;
