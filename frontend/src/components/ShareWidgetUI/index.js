import React from 'react';
import PropTypes from 'prop-types';

import { ShareIcon } from 'components/Icons';

function ShareWidgetUI(props, context) {
  const { bsSize, embedUrl, isPublic, shareUrl } = props;
  const { canAdmin } = context;

  return (
    <div id="share-widget" className="share-container pull-right" title="Sharing options">
      <div id="fb-root" />
      <button
        type="button"
        className="btn btn-default btn-{{ bsSize }} dropdown-toggle sharing-widget"
        data-toggle="dropdown"
        aria-label="Sharing widget">
        <ShareIcon />
        { bsSize === 'xs' && <span>&nbsp;Share</span> }
      </button>
      <div className="dropdown-menu share-modal arrow_box">
        <span className="glyphicon glyphicon-remove-circle" />
        {
          canAdmin &&
            <div className="public-switch clearfix {% if is_public %}hidden{% endif %}">
              {/* if anon
                <p className="make-public-desc">
                  This is a temporary collection. To preserve and share, <a href="/_register" target="_parent">Sign Up</a> or <a className="login-link" href="/_login_modal">Login</a>.
                </p>
                else */
              }
              <p className="make-public-desc">
                Collection <strong >(collection name)</strong> is set to private. To get a share link, make the collection public:
              </p>
              <div className="access-switch">
                {/* include 'public_private_switch.html' */}
              </div>
            </div>
        }
        <div className="shareables">
          <div className="platforms clearfix">
            <div id="wr-tw" />
            <div id="wr-fb" />
          </div>

          <label htmlFor="shareable-url">Copy and paste to share:</label>
          <input type="text" id="shareable-url" value={shareUrl} />

          <label htmlFor="shareable-embed-code">Embed code:</label>
          <textarea id="shareable-embed-code" value={`<iframe  src="${embedUrl}" onload="" width='640' height='480' seamless="seamless" frameborder="0" scrolling="yes" className="pager_iframe"></iframe>`} />
        </div>
      </div>
    </div>
  );
}

ShareWidgetUI.contextTypes = {
  canAdmin: PropTypes.bool
};

ShareWidgetUI.propTypes = {
  isPublic: PropTypes.bool,
  shareUrl: PropTypes.string,
  embedUrl: PropTypes.string,
  bsSize: PropTypes.string
};

ShareWidgetUI.defaultProps = {
  bsSize: ''
};

export default ShareWidgetUI;
