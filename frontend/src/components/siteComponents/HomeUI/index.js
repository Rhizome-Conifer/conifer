import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Helmet } from 'react-helmet';
import { Button, Col, Row } from 'react-bootstrap';

import config from 'config';

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
    window.location.href = config.supporterPortal;
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
    const { anonDisabled, homepageAnnouncement, product, supporterPortal } = config;

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
            <object data={require('shared/images/homepage/conifer-chest-anim.svg')} type="image/svg+xml" aria-label="Illustration of browser windows in a chest">
              <img src={require('shared/images/homepage/conifer-chest.png')} alt="Illustration of browser windows in a chest" />
            </object>
          </figure>
          <div className="intro">
            <h1>{product}</h1>
            <h2>Collect and revisit web pages.</h2>
            <p>{product} is a web archiving service that creates an interactive copy of any web page that you browse, including content revealed by your interactions such as playing video and audio, scrolling, clicking buttons, and so forth.</p>

            <div className="cta">
              <Button variant="primary" size="md" onClick={this.signup}>Create a Free Account</Button>
              <button className="button-link existing-users-btn" onClick={this.login} type="button">Existing Users Login</button>
            </div>

            { config.supporterPortal && <div className="note">Free accounts with 5GB of storage. Get more and support this project by <a href={supporterPortal} target="_blank">becoming a supporter</a>.</div> }

            <div className="note">Conifer is an online service based on <a href="https://webrecorder.net" target="_blank">Webrecorder software</a>.</div>

            {
              homepageAnnouncement &&
                <HomepageAnnouncement />
            }
          </div>
        </div>

        <Row as="section" className="landing-info">
          <Col sm={5}>
            <h3>Online Now ≠ Online Tomorrow</h3>
            <p>Links break. Information is removed from the web. Services disappear and redesigns happen. Make sure that what’s important to you will stay available.</p>
          </Col>
          <Col sm={6} md={{ offset: 1 }} className="d-none d-sm-block">
            <img src={require('shared/images/homepage/broken_link.svg')} className="center-block" alt="An illustration of three browser windows, one has a graphic of a missing content and has fallen over" />
          </Col>
        </Row>

        {/* For Web Media */}
        <Row as="section" className="landing-info">
          <Col sm={5}>
            <h3>Capture Complex Webpages</h3>
            <p>Unlike conventional crawler-based web archiving methods, {product}’s approach allows even intricate websites, such as those with embedded media, complex Javascript, user-specific content and interactions, and other dynamic elements, to be captured and restaged.</p>
          </Col>
          <Col sm={6} md={{ offset: 1 }} className="d-none d-sm-block">
            <object data={require('shared/images/homepage/complex_dynamic_webpages-w-pause.svg')} type="image/svg+xml" aria-label="An animated graphic of assets being capture as someone browses a website">
              <img src={require('shared/images/homepage/complex_webpages.png')} className="center-block" alt="Illustration of media being captured from a browser" />
            </object>
          </Col>
        </Row>

        {/* autopilot */}
        <Row as="section" className="landing-info">
          <Col sm={5}>
            <h3>Autopilot Your Captures</h3>
            <p>Capturing pages on a popular web platform? Autopilot behaviors may be able to speed up your capture via automation.</p>
          </Col>
          <Col sm={6} md={{ offset: 1 }} className="d-none d-sm-block">
            <figure>
              {
                !__DESKTOP__ &&
                  <video autoPlay loop muted poster={require('shared/images/homepage/autopilot.jpg')}>
                    <source src={require('shared/media/autopilot.mp4')} type="video/mp4" />
                    <source src={require('shared/media/autopilot.webm')} type="video/webm" />
                  </video>
              }
            </figure>
          </Col>
        </Row>

        <Row as="section" className="advanced-features">
          <Col xs={{ span: 10, offset: 1}}>
            <h3>Advanced Features</h3>
            <dl>
              <dt>Login and Capture</dt>
              <dd>Capture what you see on websites when you're logged into them, and share archived pages without revealing your credentials.</dd>

              <dt>Publish and Share</dt>
              <dd>Make your collections publicly accessible or keep them private.</dd>

              <dt>Own Your Data</dt>
              <dd>Download your web archives in the ISO standard WARC file format.</dd>

              <dt>Pre-configured browsers for best capturing results</dt>
              <dd>{product}'s Remote Browser feature provides access to a range of preconfigured browsers running on the {product} server. They offer for the most thorough capture of network traffic, and support for Flash.</dd>
            </dl>
          </Col>
        </Row>

        <Row as="section">
          <Col xs={12} lg={{ span: 10, offset: 1 }} className="supporter">
            <header>
              <h1>You can support a free platform for archiving the web.</h1>
            </header>

            <div className="oss-intro">
              <h3>{product} is an open source web archiving initiative by Rhizome, an institution supporting born-digital art and culture</h3>
              <p>Becoming a supporter or donor helps us offset our operational costs, keeping Conifer a sustainable project.</p>
            </div>

            {
              config.supporterPortal &&
                <div className="supportCTA">
                  {/*<h3>You can support free, open source tools for archiving the web.</h3>*/}
                  <Button variant="primary" size="lg" onClick={this.goToSupporterSite}>Become a Supporter</Button>
                  <a href={config.supporterPortal} target="_blank">Learn more</a>
                  <p>{product} is a project of Rhizome, a registered 501(c)(3) non-profit organization. Your donations are tax-deductible.</p>
                </div>
            }
          </Col>
        </Row>
      </React.Fragment>
    );
  }
}


export default HomeUI;
