import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Helmet } from 'react-helmet';
import { Button, Col, Row } from 'react-bootstrap';

import { anonDisabled, homepageAnnouncement, product, supporterPortal } from 'config';

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
            <object data={require('shared/images/homepage/conifer-chest-anim.svg')} type="image/svg+xml" aria-label="Illustration of browser windows in a chest">
              <img src={require('shared/images/homepage/conifer-chest.png')} alt="Illustration of browser windows in a chest" />
            </object>
          </figure>
          <div className="intro">
            <h1>{product}</h1>
            <h2>Collect and revisit web pages.</h2>
            <p>{product} Conifer is a web archiving service that creates an interactive copy of any web page that you browse, including content revealed by your interactions such as playing video and audio, scrolling, clicking buttons, and so forth.</p>

            <div className="cta">
              <Button variant="primary" size="lg" onClick={this.signup}>Creat a Free Account</Button>
              <button className="button-link" onClick={this.login} type="button">Existing Users Login</button>
            </div>

            { supporterPortal && <div className="note">Free accounts with 5GB of storage. Get more and support this project by <a href={supporterPortal} target="_blank">becoming a supporter</a>.</div> }

            <div className="note">Conifer is an online service based on <a href="https://webrecorder.net" target="_blank">Webrecorder software</a>.</div>

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
              <img src={require('shared/images/homepage/broken_link.svg')} className="center-block" alt="An illustration of three browser windows, one has a graphic of a missing content and has fallen over" />
            </div>
          </div>
        </section>

        {/* For Web Media */}
        <section className="row landing-info">
          <div>
            <div className="col-sm-6">
              <h3>Capture Complex Webpages</h3>
              <p>Unlike conventional crawler-based web archiving methods, {product}’s approach allows even intricate websites, such as those with embedded media, complex Javascript, user-specific content and interactions, and other dynamic elements, to be captured and restaged.</p>
            </div>
            <div className="col-sm-6 hidden-xs">
              <object data={require('shared/images/homepage/complex_dynamic_webpages-w-pause.svg')} type="image/svg+xml" aria-label="An animated graphic of assets being capture as someone browses a website">
                <img src={require('shared/images/homepage/complex_webpages.png')} className="center-block" alt="Illustration of media being captured from a browser" />
              </object>
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
              supporterPortal &&
                <div className="supportCTA">
                  {/*<h3>You can support free, open source tools for archiving the web.</h3>*/}
                  <Button variant="primary" size="lg" onClick={this.gotToSupporterSite}>Become a Supporter</Button>
                  <a href={supporterPortal} target="_blank">Learn more</a>
                  <p>{product} is a project of Rhizome, a registered 501(c)(3) non-profit organization. Your donations are tax-deductible.</p>
                </div>
            }

            <div className="tools-intro">
              <h2>Desktop Tools</h2>
              <p>In partnership with the Webrecorder project, we aim to make web archiving accessible to all, and ensure interoperability in between tools. Here are some apps we have developed together:</p>
            </div>

            <div className="tool">
              <img src={require('shared/images/homepage/desktop.png')} alt="Desktop Logo" />
              <h4>Webrecorder Desktop App</h4>
              <p>Create, manage and store web archives on your local computer; import them to Conifer for public presentation.</p>
              <Button variant="primary" onClick={this.desktopApp}>Download Desktop App</Button>
            </div>

            <div className="tool">
              <img src={require('shared/images/homepage/player.png')} alt="Player Logo" />
              <h4>Webrecorder Player App</h4>
              <p>Export Conifer collections and access them offline.</p>
              <Button variant="primary" onClick={this.playerApp}>Download Player App</Button>
            </div>
          </Col>
        </Row>
      </React.Fragment>
    );
  }
}


export default HomeUI;
