import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import SizeFormat from 'components/SizeFormat';


class TempUsageUI extends Component {
  static propTypes = {
    handleInput: PropTypes.func,
    hideModal: PropTypes.func,
    moveTemp: PropTypes.bool,
    tempCollName: PropTypes.string,
    tempUser: PropTypes.object,
    toColl: PropTypes.string
  };

  linkClick = () => {
    this.props.hideModal();
  }

  render() {
    const { handleInput, moveTemp, tempUser, toColl } = this.props;
    const recCount = tempUser.get('rec_count');
    const usage = tempUser.getIn(['space_utilization', 'used']);
    const collLink = `/${tempUser.get('username')}/temp`;

    return (
      <div className="alert alert-info" role="alert">
        <div className="form-group">
          <h5>You have temporarily recorded <Link to={collLink} onClick={this.linkClick}><b><SizeFormat bytes={usage} /></b></Link>.<br />Would you like to import this collection into your account?</h5>
          <div className="form-group temp-move-coll">
            <input id="coll-move" type="checkbox" name="moveTemp" onChange={handleInput} checked={moveTemp} />
            <label htmlFor="coll-move">&nbsp;&nbsp;Yes, import <Link to={collLink} onClick={this.linkClick}><b>{recCount} recording{recCount === 1 ? '' : 's'}</b></Link> into my account.</label>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="collection_name">Collection Name:</label>
          <input
            type="text"
            name="toColl"
            className="to-coll form-control"
            onChange={handleInput}
            value={toColl}
            placeholder="New Collection Name" />
          <div className="help-block with-errors" />
        </div>
      </div>
    );
  }
}

export default TempUsageUI;
