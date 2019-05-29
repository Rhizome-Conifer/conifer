import React from 'react';
import PropTypes from 'prop-types';

import { supporterPortal } from 'config';

import { XIcon } from 'components/icons';

import './style.scss';


const SupporterAnnounce = React.memo(({ dismiss }) => {

  const launchSupporter = () => {
    window.location.href = supporterPortal;
  }

  return (
    <div className="supporter-announce">
      <div className="banner">
        <div className="wrapper">
          <h3>Help us provide free tools and services that enable anyone to archive web resources.</h3>
          <button className="dismiss" onClick={dismiss} type="button"><XIcon /></button>
        </div>
      </div>
      <div className="info">
        <p>
          Dear Webrecorder community,<br /><br />
          We are excited to announce a new opportunity for Webrecorder.io users and community members back our services as supporters or donors. Donors are welcome to contribute any amount. Supporters who contribute $20/month or $200/year will receive an upgraded user account with no network quota and 40 GB of storage.
          <br /><br />
          These funds will help us thrive as a sustainable open source project and continue to offer free Webrecorder.io user accounts. Free accounts will continue to have 5 GB of storage and the same full range of Webrecorder tools as before.
        </p>
        <div className="signup-link">
          <button className="rounded" onClick={launchSupporter} type="button">Become a Supporter</button>
          <div className="payment-sources">
            <img src={require('shared/images/visa_36_2x.png')} alt="Visa logo" />
            <img src={require('shared/images/mc_vrt_opt_pos_36_2x.png')} alt="Mastercard logo" />
            <img src={require('shared/images/amex_36_2x.png')} alt="American Express logo" />
          </div>
        </div>
      </div>
    </div>
  );
});


export default SupporterAnnounce;
