import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Toggle from 'react-toggle';

import Modal from 'components/Modal';


class NewCollection extends Component {
  static propTypes = {
    close: PropTypes.func,
    showModal: PropTypes.bool,
    createCollection: PropTypes.func,
    creatingCollection: PropTypes.bool,
    visible: PropTypes.bool
  };

  constructor(props) {
    super(props);

    this.state = { collTitle: 'New Collecton', isPublic: false };
  }

  submit = (evt) => {
    evt.preventDefault();
    const { collTitle, isPublic } = this.state;

    this.props.createCollection(collTitle, isPublic);
  }

  handleInput = (evt) => {
    this.setState({ collTitle: evt.target.value });
  }

  togglePublic = (evt) => {
    this.setState({ isPublic: !this.state.isPublic });
  }

  render() {
    const { close, creatingCollection, visible } = this.props;
    const { collTitle, isPublic } = this.state;

    return (
      <Modal
        closeCb={close}
        header="Create New Collection"
        visible={visible}>
        <form onSubmit={this.submit} id="create-coll" className="form-horizontal">
          <span className="form-group col-md-5">
            <label htmlFor="collection">Collection Name:</label>
            <input type="text" id="title" name="title" className="form-control" onChange={this.handleInput} value={collTitle} required />
          </span>

          <span className="col-md-6 col-md-offset-1">
            <div><label htmlFor="public-switch"><span className="glyphicon glyphicon-globe" style={{ marginRight: '4px' }} />Make public (visible to all)?</label></div>
            <Toggle
              id="public-switch"
              defaultChecked={isPublic}
              onChange={this.togglePublic} />
          </span>

          <button className="btn btn-lg btn-primary btn-block" type="submit" disabled={creatingCollection}>Create</button>
        </form>
      </Modal>
    );
  }
}

export default NewCollection;
