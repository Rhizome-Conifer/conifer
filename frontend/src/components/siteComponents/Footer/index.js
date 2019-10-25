import React from 'react';
import { Link } from 'react-router-dom';

import { announceMailingList, supportEmail, supporterPortal } from 'config';

import './style.scss';


function Footer() {

  const donateNow = () => {
    window.location.href = supporterPortal;
  };

  return (
    <footer className="footer">
      <div className="container top-buffer bottom-buffer">
        <div className="row">
          <div className="col-xs-12 col-sm-6 project-info">
            <div className="links">
              <ul>
                <li><Link to="/_faq">About the Webrecorder Project</Link></li>
                <li><a href="https://guide.webrecorder.io/" target="_blank">User Guide</a></li>
                <li><Link to="/_policies">Terms & Policies</Link></li>
              </ul>
              <ul>
                <li><a href="https://blog.webrecorder.io" target="_blank">Blog</a></li>
                <li><a href={`mailto:${supportEmail}`} className="contact">Contact</a></li>
                <li><a href="https://twitter.com/webrecorder_io" aria-label="Twitter" target="_blank">Twitter</a></li>
                <li><a href="https://github.com/webrecorder/webrecorder" aria-label="Github" target="_blank">Github</a></li>
                <li><a href="https://rhizome.org" target="_blank">Rhizome.org</a></li>
              </ul>
            </div>
            {
              announceMailingList &&
                <form method="post" id="email-signup" className="navbar-form mc-embedded-subscribe-form" action={announceMailingList}>
                  <div className="form-group-sm">
                    <input type="email" name="EMAIL" className="form-control" placeholder="your@email.com" />
                    <button type="submit" className="btn btn-default btn-sm">Get Updates</button>
                  </div>
                  <div style={{ position: 'absolute', left: '-5000px' }} aria-hidden="true">
                    <input type="text" name="b_a1487b13ca8ed17d052f71f12_7f979630a1" tabIndex="-1" defaultValue="" />
                  </div>
                </form>
            }
            <p>
              This instance of the Webrecorder web application is hosted by Rhizome at the New Museum. The Andrew W. Mellon Foundation is the lead supporter of the Webrecorder Initiative.
            </p>
          </div>

          {
            supporterPortal &&
              <div className="col-xs-12 col-sm-6 donate-info hidden-xs">
                <p>Webrecorder is a rapidly developing community project maintained by a non-profit arts organization. Becoming a supporter or donor helps us offset our operational costs, keeping Webrecorder a sustainable project.</p>
                <button className="rounded" onClick={donateNow} type="button">Donate Now</button>
                <a href={supporterPortal} target="_blank">Learn More About Becoming a Supporter</a>
              </div>
          }
        </div>
      </div>
    </footer>
  );
}

export default Footer;
