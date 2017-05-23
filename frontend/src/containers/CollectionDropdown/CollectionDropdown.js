import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { selectCollection } from 'redux/modules/user';
import CollectionDropdownUI from 'components/CollectionDropdownUI';


class CollectionDropdown extends Component {
  static defaultProps = {
    collections: [],
  }

  static propTypes = {
    collections: PropTypes.array
  }

  render() {
    return (
      <CollectionDropdownUI {...this.props} />
    );
  }
}

const mapStateToProps = (state) => {
  const { user } = state;
  return {
    collections: user.data.collections,
    activeCollection: user.activeCollection
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    setCollection: coll => dispatch(selectCollection(coll))
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(CollectionDropdown);
