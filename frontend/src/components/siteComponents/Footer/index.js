import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from 'react-bootstrap';

import { announceMailingList, product, supportEmail, supporterPortal } from 'config';

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
                <li><Link to="/_faq">About {product}</Link></li>
                <li><a href="https://guide.conifer.rhizome.org/" target="_blank">User Guide</a></li>
                <li><Link to="/_policies">Terms & Policies</Link></li>
              </ul>
              <ul>
                <li><a href="https://blog.conifer.rhizome.org" target="_blank">Blog</a></li>
                <li><a href={`mailto:${supportEmail}`} className="contact">Contact</a></li>
                <li><a href="https://twitter.com/RhizomeConifer" aria-label="Twitter" target="_blank">Twitter</a></li>
                <li><a href="https://github.com/rhizome-conifer/conifer" aria-label="Github" target="_blank">Github</a></li>
                <li><a href="https://rhizome.org" target="_blank">Rhizome.org</a></li>
              </ul>
            </div>
            {
              announceMailingList &&
                <form method="post" id="email-signup" className="navbar-form mc-embedded-subscribe-form" action={announceMailingList}>
                  <div className="form-group-sm">
                    <input type="email" name="EMAIL" className="form-control" placeholder="your@email.com" />
                    <Button type="submit" variant="primary">Get Updates</Button>
                  </div>
                  <div style={{ position: 'absolute', left: '-5000px' }} aria-hidden="true">
                    <input type="text" name="b_a1487b13ca8ed17d052f71f12_7f979630a1" tabIndex="-1" defaultValue="" />
                  </div>
                </form>
            }
          </div>

          {
            supporterPortal &&
              <div className="col-xs-12 col-sm-6 donate-info d-none d-sm-block">
                <p>{product} is a rapidly developing community project maintained by a non-profit arts organization. Becoming a supporter or donor helps us offset our operational costs, keeping {product} a sustainable project.</p>
                <Button variant="secondary" onClick={donateNow} type="button">Learn More</Button>
              </div>
          }
        </div>
      </div>
    </footer>
  );
}

export default Footer;
