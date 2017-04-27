import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { info } from 'redux/modules/remoteBrowsers';

import CollectionDropdownUI from 'components/CollectionDropdownUI';


class CollectionDropdown extends Component {
  static propTypes = {
    collections: PropTypes.array,
  }

  static defaultProps = {
    collections: [],
  }

  render() {
    return (
      <CollectionDropdownUI {...this.props} />
    );
  }
}

const mapStateToProps = (state) => {
  const { collections } = state.collections;
  return {
    collections
  };
};

// const mapDispatchToProps = (dispatch) => {
//   return {
//     getBrowsers: () => dispatch(load()),
//     setBrowser: br => dispatch(selectBrowser(br))
//   };
// };

export default connect(
  mapStateToProps,
  //mapDispatchToProps
)(CollectionDropdown);
