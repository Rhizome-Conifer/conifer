import React, { Component } from 'react';
import { connect } from 'react-redux';
import { fromJS } from 'immutable';

import { selectCollection } from 'redux/modules/user';
import CollectionDropdownUI from 'components/CollectionDropdownUI';


class CollectionDropdown extends Component {
  static defaultProps = fromJS({
    collections: [],
  })

  render() {
    return (
      <CollectionDropdownUI {...this.props} />
    );
  }
}

const mapStateToProps = (state) => {
  const user = state.get('user');
  return {
    collections: user.getIn(['data', 'collections']),
    activeCollection: user.get('activeCollection')
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
