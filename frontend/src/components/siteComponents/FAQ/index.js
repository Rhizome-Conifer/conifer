import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';

import { product } from 'config';

import './style.scss';


function FAQ() {
  return (
    <div className="container faq">
      <Helmet>
        <title>About</title>
      </Helmet>
      <div className="row heading">
        <aside className="col-sm-3 hidden-xs">
          <img src={require('shared/images/logo.svg')} alt={`${product}'s logo`} />
        </aside>
        <div className="col-xs-10 col-xs-push-1 col-sm-9 col-sm-push-0">
          <h2>{product} is both a tool to create high-fidelity, interactive captures of any web site you browse and a platform to make those captured websites accessible.</h2>
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
            <span>2016-2020&nbsp;supported&nbsp;by</span>
            <a href="https://mellon.org/grants/grants-database/grants/rhizome-communications-inc/41500666/" target="_blank">
              <img src={require('shared/images/mellon-fdn.svg')} className="mellon-logo" alt="Andrew W. Mellon Foundation" />
            </a>
          </p>

          <p className="credit">
            2016-2018&nbsp;supported&nbsp;by
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

          <h4 className="q">What makes {product} different?</h4>
          <p className="a">
            While most web archive projects automatically create copies of material found on the public web, {product} is a user-driven platform. Users can create, curate, and share their own collections of web materials. This can even include items that would be only revealed after logging in or performing complicated actions on a web site.
          </p>
          <p className="a">
            On the technical side, {product} focuses on “high fidelity” web archiving. Items relying on complex scripting, such as embedded videos, fancy navigation, or 3D graphics have a much higher success rate for capture with {product} than with traditional web archives.
          </p>

          <h4 className="q">How do I use {product}?</h4>
          <p className="a">
            <a href="https://guide.conifer.rhizome.org/" target="_blank">We created a user guide to help get acquianted.</a>
          </p>

          <h4 className="q">Is {product} free to use?</h4>
          <p className="a">
            Generally, yes! {product} offers a limited free tier with 5GB of storage space with some networking quota restrictions. Access to collections that users made public is always free of charge an unlimited.
          </p>
          <p className="a">
            The software driving the service is open source under the Apache license.
          </p>

          <h4 className="q">There has to be some tiny print, right?</h4>
          <p className="a">
            <Link to="/_policies">Yes!</Link>
          </p>

          <h4 className="q">Who created {product}?</h4>
          <p className="a">
            {product} is the result of a multi-year research and development project to create a next generation web archiving service that was hosted at Rhizome from 2015 to 2020 under the name “Webrecorder.io.” The open source components created during this time now form the foundation of {product}. These components are maintained independently by the <a href="https://webrecorder.net">Webrecorder</a> project. With the renaming from Webrecorder.io to {product}, Rhizome became the permanent steward of the service.
          </p>

          <h4 className="q">What's Rhizome?</h4>
          <p className="a">
            Founded on the internet in 1996, Rhizome is a non-profit organization which commissions, presents, and preserves digital art. Since 2003, Rhizome has been an independent affiliate in residence at the <a href="http://newmuseum.org/" target="_blank">New Museum</a> in New York City, and is based at <a href="http://www.newinc.org/" target="_blank">NEW INC</a>, the first museum-led incubator. As it happens, to preserve net art you need to build complex things that can capture complex things.
          </p>

          <h4 className="q">How is {product} funded?</h4>
          <p className="a">
            Major support has been provided by The Andrew W. Mellon Foundation.
            <br /><br />
            Additional support for Rhizome digital preservation is provided by the James S. and John L. Knight Foundation, Google and the Google Cultural Institute, the National Endowment for the Arts, and the New York State Council on the Arts with the support of Governor Andrew Cuomo and the New York State Legislature.
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
