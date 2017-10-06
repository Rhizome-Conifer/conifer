import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { List } from 'immutable';
import { DropdownButton, MenuItem } from 'react-bootstrap';

import { NewCollection } from 'components/siteComponents';

import './style.scss';


class CollectionDropdownUI extends Component {
  static propTypes = {
    activeCollection: PropTypes.object,
    collections: PropTypes.object,
    creatingCollection: PropTypes.bool,
    createNewCollection: PropTypes.func,
    loadUser: PropTypes.func,
    newCollection: PropTypes.string,
    setCollection: PropTypes.func,
    user: PropTypes.object
  };

  static defaultProps = {
    collections: List(),
  };

  constructor(props) {
    super(props);

    this.state = { showModal: false };
  }

  componentWillReceiveProps(nextProps) {
    const { creatingCollection, loadUser, user } = this.props;
    const { newCollection } = nextProps;

    // if incoming prop has a newCollection object and we are currently creating
    // a collection, close the modal and select the new collection
    if (newCollection && creatingCollection) {
      loadUser(user.get('username'))
        .then(this.close)
        .then(
          () => this.collectionChoice(newCollection)
        );
    }
  }

  collectionChoice = (id) => {
    this.props.setCollection(id);
  }

  createCollection = (collTitle, isPublic) => {
    const { createNewCollection, user } = this.props;

    createNewCollection(user.get('username'), collTitle, isPublic);
  }

  toggle = () => {
    this.setState({ showModal: !this.state.showModal });
  }

  close = () => {
    this.setState({ showModal: false });
  }

  render() {
    const { activeCollection, collections, creatingCollection, user } = this.props;
    const { showModal } = this.state;

    const buttonTitle = activeCollection.title ? activeCollection.title : 'Choose a collection';

    return (
      <div className="wr-collection-menu">
        {
          user && user.get('username') && !user.get('anon') &&
            <div>
              <label className="left-buffer" htmlFor="collection">Add to collection:&emsp;</label>
              <DropdownButton title={buttonTitle} id="wr-collecton-dropdown" onSelect={this.collectionChoice}>
                <MenuItem onClick={this.toggle}>+ Create new collection</MenuItem>
                <MenuItem divider />
                {
                  collections.map((coll) => {
                    const id = coll.get('id');
                    const title = coll.get('title');

                    return (
                      <MenuItem
                        key={id}
                        eventKey={id}
                        className={title.length > 50 ? 'make-wrap' : ''}
                        active={activeCollection.id === id}>
                        { title }
                      </MenuItem>
                    );
                  })
                }
              </DropdownButton>
            </div>
        }
        <NewCollection
          close={this.close}
          visible={showModal}
          createCollection={this.createCollection}
          creatingCollection={creatingCollection} />
      </div>
    );
  }
}

export default CollectionDropdownUI;
