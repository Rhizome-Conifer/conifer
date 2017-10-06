import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { setPublic } from 'redux/modules/collection';

import { ShareWidgetUI } from 'components/controls';

class ShareWidget extends Component {

  static contextTypes = {
    metadata: PropTypes.object
  }

  static propTypes = {
    collection: PropTypes.object,
    params: PropTypes.object,
    setCollPublic: PropTypes.func,
    timestamp: PropTypes.string,
    url: PropTypes.string
  }

  render() {
    const { metadata: { host } } = this.context;
    const { collection, params: { user, coll }, timestamp, url } = this.props;

    const shareUrl = `${host}${user}/${coll}/${timestamp}/${url}`;
    const embedUrl = `${host}_embed/${user}/${coll}/${timestamp}/${url}`;
    const isPublic = collection.get('isPublic') === '1';

    return (
      <ShareWidgetUI
        isPublic={isPublic}
        setPublic={this.props.setCollPublic}
        collection={collection}
        shareUrl={shareUrl}
        embedUrl={embedUrl} />
    );
  }
}

const mapStateToProps = (state) => {
  return {
    collection: state.get('collection'),
    timestamp: state.getIn(['controls', 'timestamp']),
    url: state.getIn(['controls', 'url'])
  };
};

const mapDispatchToProps = (dispatch, props) => {
  return {
    setCollPublic: (collId, user) => dispatch(setPublic(collId, user))
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(ShareWidget);
