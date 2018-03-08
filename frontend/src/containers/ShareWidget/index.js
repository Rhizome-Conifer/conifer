import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { remoteBrowserMod } from 'helpers/utils';
import { setPublic } from 'redux/modules/collection';
import { showModal } from 'redux/modules/userLogin';

import { ShareWidgetUI } from 'components/controls';


class ShareWidget extends Component {

  static contextTypes = {
    metadata: PropTypes.object
  }

  static propTypes = {
    activeBrowser: PropTypes.string,
    collection: PropTypes.object,
    params: PropTypes.object,
    setCollPublic: PropTypes.func,
    timestamp: PropTypes.string,
    url: PropTypes.string
  }

  render() {
    const { activeBrowser, metadata: { host } } = this.context;
    const { collection, params: { user, coll }, showLoginModal, timestamp, url } = this.props;

    const tsMod = remoteBrowserMod(activeBrowser, timestamp);

    const shareUrl = `${host}${user}/${coll}/${tsMod}/${url}`;
    const embedUrl = `${host}_embed/${user}/${coll}/${tsMod}/${url}`;
    const isPublic = collection.get('isPublic') === '1';

    return (
      <ShareWidgetUI
        isPublic={isPublic}
        setPublic={this.props.setCollPublic}
        collection={collection}
        shareUrl={shareUrl}
        embedUrl={embedUrl}
        showLoginModal={showLoginModal} />
    );
  }
}

const mapStateToProps = ({ app }) => {
  return {
    activeBrowser: app.getIn(['remoteBrowsers', 'activeBrowser']),
    collection: app.get('collection'),
    timestamp: app.getIn(['controls', 'timestamp']),
    url: app.getIn(['controls', 'url'])
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    setCollPublic: (collId, user) => dispatch(setPublic(collId, user)),
    showLoginModal: () => dispatch(showModal(true))
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(ShareWidget);
