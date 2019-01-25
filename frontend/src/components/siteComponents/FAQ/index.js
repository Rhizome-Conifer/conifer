import React from 'react';
import Helmet from 'react-helmet';
import { Link } from 'react-router-dom';

import { supportEmail } from 'config';

import './style.scss';


function FAQ() {
  return (
    <div className="container faq">
      <Helmet>
        <title>About</title>
      </Helmet>
      <div className="row heading">
        <aside className="col-sm-3 hidden-xs">
          <img src={require('shared/images/logo.svg')} alt="Webrecorder logo" />
        </aside>
        <div className="col-xs-10 col-xs-push-1 col-sm-9 col-sm-push-0">
          <h2>Webrecorder is both a tool to create high-fidelity, interactive recordings of any web site you browse and a platform to make those recordings accessible.</h2>
        </div>
      </div>

      <div className="row">
        <aside className="col-sm-3 hidden-xs">
          <p className="credit">
            <span>A project by</span>
            <a href="https://rhizome.org" target="_blank">
              <img src={require('shared/images/Rhizome-Logo_med.png')} className="rhizome-logo" alt="Rhizome logo" />
            </a>
          </p>

          <p className="credit">
            <span>With generous support&nbsp;from</span>
            <a href="https://mellon.org/grants/grants-database/grants/rhizome-communications-inc/41500666/" target="_blank">
              <img src={require('shared/images/mellon-fdn.svg')} className="mellon-logo" alt="Andrew W. Mellon Foundation" />
            </a>
          </p>

          <p className="credit">
            Outreach support is provided by
            <a href="https://www.knightfoundation.org/press/releases/three-projects-will-help-better-inform-the-public-through-technology-innovation-with-540-000-from-knight-foundation" target="_blank">
              <img src={require('shared/images/KF_logo-stacked.svg')} className="knight-fnd" alt="James S. and John L. Knight Foundation" />
            </a>
          </p>
        </aside>
        <div className="col-xs-10 col-xs-push-1 col-sm-9 col-sm-push-0">
          <h4 className="q">What are Web Archives?</h4>
          <p className="a">
            A web archive is a record of web resources. It may include HTML and images, scripts, stylesheets, as well as video, audio and other elements that web pages and web apps are made of, all in one file.<br />
          </p>

          <h4 className="q">What makes Webrecorder different?</h4>
          <p className="a">
            What most differentiates Webrecorder is its focus on "dynamic web content." The web once delivered documents, like HTML pages. Today, it delivers complex software customized for every user, like individualized social media feeds. Other existing digital preservation solutions were built for that earlier time and cannot adequately cope with what the web has become. Webrecorder, by contrast, focuses on all that dynamic content, such as embedded video and complex javascript, addressing our present and future.
          </p>

          <h4 className="q">How do I use Webrecorder?</h4>
          <p className="a">
            <a href="https://guide.webrecorder.io/" target="_blank">We created a user guide to help get acquianted.</a>
          </p>

          <h4 className="q">What can I do with recordings made in Webrecorder?</h4>
          <p className="a">
            After you create a recording, you can <a href="/_register">register</a> and <a href="/_login">login</a> to an account so we can host the recording(s) for you on webrecorder.io. We offer up to 5GB of free storage for every registered user.
            <br /><br />
            You can also download the recordings as WARC files and view them offline on your own machine, using our <a href="https://github.com/webrecorder/webrecorderplayer-electron#webrecorder-player" target="_blank"><strong>Webrecorder&nbsp;Player</strong></a> desktop application.
          </p>

          <h4 className="q">Where can I see some things captured with Webrecorder?</h4>
          <p className="a">
            <a href="http://webenact.rhizome.org/" target="_blank">Here's</a> a collection made by Rhizome, and <a href="https://webrecorder.io/despens">another</a> by preservation director Dragan Espenschied.
          </p>

          <h4 className="q">Is Webrecorder free to use?</h4>
          <p className="a">
            Generally, yes! Webrecorder is a free and open-source software (under the Apache License). Check out the details <a href="https://github.com/webrecorder/webrecorder" target="_blank">here</a>. That said, specific use-cases and integrations may require additional support or storage that will come at a cost. <a href={`mailto:${supportEmail}`}>(Email us for details.)</a>
          </p>

          <h4 className="q">There has to be some tiny print, right?</h4>
          <p className="a">
            <Link to="/_policies">Yes!</Link>
          </p>

          <h4 className="q">Who created Webrecorder?</h4>
          <p className="a">
            Webrecorder was developed by <a href="https://github.com/ikreymer" target="_blank">Ilya Kreymer</a>, and is a project of Rhizome under its digital preservation program led by <a href="https://github.com/despens" target="_blank">Dragan&nbsp;Espenschied</a>. It's currently developed by Kreymer with the assistance of Senior Front-End Developer <a href="https://github.com/m4rk3r" target="_blank">Mark Beasley</a>, Design Lead <a href="https://github.com/patshiu" target="_blank">Pat&nbsp;Shiu</a>, and Contract Developer <a href="https://github.com/atomotic" target="_blank">Raffaele Messuti</a>.
          </p>

          <h4 className="q">What's Rhizome?</h4>
          <p className="a">
            Founded on the internet in 1996, Rhizome is a non-profit organization which commissions, presents, and preserves digital art. Since 2003, Rhizome has been an independent affiliate in residence at the <a href="http://newmuseum.org/" target="_blank">New Museum</a> in New York City, and is based at <a href="http://www.newinc.org/" target="_blank">NEW INC</a>, the first museum-led incubator. As it happens, to preserve net art you need to build complex things that can capture complex things.
          </p>

          <h4 className="q">How is Webrecorder funded?</h4>
          <p className="a">
            Major support for the Webrecorder initiative is provided by The Andrew W. Mellon Foundation.
            <br /><br />
            Outreach, events, and research around Webrecorder is supported by James S. and John L. Knight Foundation.
            <br /><br />
            Additional support for Rhizome digital preservation is provided by Google and the Google Cultural Institute, the National Endowment for the Arts, and the New York State Council on the Arts with the support of Governor Andrew Cuomo and the New York State Legislature.
          </p>
          <div className="support-logos">
            <a href="https://mellon.org/grants/grants-database/grants/rhizome-communications-inc/41500666/" target="_blank">
              <img src={require('shared/images/mellon-fdn.svg')} width="100" alt="Andrew W. Mellon Foundation" />
            </a>

            <a href="https://www.knightfoundation.org/press/releases/three-projects-will-help-better-inform-the-public-through-technology-innovation-with-540-000-from-knight-foundation" target="_blank">
              <img src={require('shared/images/KF_logo-stacked.svg')} width="100" alt="James S. and John L. Knight Foundation" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FAQ;
