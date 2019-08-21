import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import SizeFormat from 'components/SizeFormat';


class TempUsageUI extends Component {
  static propTypes = {
    handleInput: PropTypes.func,
    hideModal: PropTypes.func,
    loadUsage: PropTypes.func,
    moveTemp: PropTypes.bool,
    tempCollName: PropTypes.string,
    tempUser: PropTypes.object,
    toColl: PropTypes.string
  };

  constructor(props) {
    super(props);

    const { tempUser } = props;
    if (tempUser) {
      // get latest stats
      props.loadUsage();
    }
  }

  focusInput = () => {
    this.input.setSelectionRange(0, this.props.toColl.length);
  }

  linkClick = () => {
    this.props.hideModal();
  }

  render() {
    const { handleInput, moveTemp, tempUser, toColl } = this.props;

    // check if tempUser exists
    if (!tempUser) {
      return null;
    }

    const recCount = tempUser.get('num_recordings');
    const usage = tempUser.getIn(['space_utilization', 'used']);
    const collLink = `/${tempUser.get('username')}/temp`;

    return (
      <div className="alert alert-info" role="alert">
        <div className="form-group">
          <h5>You have captured <Link to={collLink} onClick={this.linkClick}><b><SizeFormat bytes={usage} /></b></Link> in <Link to={collLink} onClick={this.linkClick}><b>{recCount} session{recCount === 1 ? '' : 's'}</b></Link> in your temporary collection.</h5>
          <div className="form-group temp-move-coll">
            <input id="coll-leave" type="radio" name="moveTemp" onChange={handleInput} value="no" checked={!moveTemp} />
            <label htmlFor="coll-leave">&nbsp;&nbsp;Discard the temporary collection</label><br />

            <input id="coll-move" type="radio" name="moveTemp" onChange={handleInput} value="yes" checked={moveTemp} />
            <label htmlFor="coll-move">&nbsp;&nbsp;Add the temporary collection to my account with the name:</label>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="collection_name">Collection Name:</label>
          <input
            className="to-coll form-control"
            name="toColl"
            onChange={handleInput}
            onFocus={this.focusInput}
            ref={(o) => { this.input = o; }}
            type="text"
            value={toColl} />
          <div className="help-block with-errors" />
        </div>
      </div>
    );
  }
}

export default TempUsageUI;
