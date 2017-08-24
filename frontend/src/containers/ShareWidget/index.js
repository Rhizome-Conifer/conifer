import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { setPublic } from 'redux/modules/collection';

import { ShareWidgetUI } from 'components/Controls';

class ShareWidget extends Component {

  static contextTypes = {
    metadata: PropTypes.object
  }

  static propTypes = {
    collection: PropTypes.object,
    params: PropTypes.object,
    setCollPublic: PropTypes.func
  }

  render() {
    const { metadata: { host } } = this.context;
    const { collection, params: { user, coll, ts, splat } } = this.props;

    const shareUrl = `${host}${user}/${coll}/${ts}/${splat}`;
    const embedUrl = `${host}_embed/${user}/${coll}/${ts}/${splat}`;
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
