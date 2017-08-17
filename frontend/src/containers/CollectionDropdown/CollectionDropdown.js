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
    const { auth } = this.props;
    const user = auth.get('user');

    return (
      <div style={{ display: 'inline' }}>
        {
          user && user.get('username') && !user.get('anon') &&
            <div style={{ display: 'inline' }}>
              <label className="left-buffer" htmlFor="collection">Add to collection:&emsp;</label>
              <CollectionDropdownUI {...this.props} />
            </div>
        }
      </div>
    );
  }
}

const mapStateToProps = (state) => {
  const user = state.get('user');
  const auth = state.get('auth');
  return {
    auth,
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
