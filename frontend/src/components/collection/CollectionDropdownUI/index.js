import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { List } from 'immutable';
import { DropdownButton, MenuItem } from 'react-bootstrap';

import { NewCollection } from 'components/siteComponents';
import { WarcIcon } from 'components/icons';

import './style.scss';


class CollectionDropdownUI extends Component {
  static propTypes = {
    activeCollection: PropTypes.object,
    canCreateCollection: PropTypes.bool,
    collections: PropTypes.object,
    collectionError: PropTypes.string,
    creatingCollection: PropTypes.bool,
    createNewCollection: PropTypes.func,
    fromCollection: PropTypes.string,
    label: PropTypes.oneOfType([
      PropTypes.bool,
      PropTypes.string
    ]),
    loading: PropTypes.bool,
    loadUserCollections: PropTypes.func,
    mostRecent: PropTypes.string,
    newCollection: PropTypes.string,
    setCollection: PropTypes.func,
    user: PropTypes.object,
  };

  static defaultProps = {
    canCreateCollection: true,
    collections: List(),
    label: 'Add to collection:&emsp;'
  };

  constructor(props) {
    super(props);

    // prepouplate collection
    if (props.fromCollection) {
      props.setCollection(props.fromCollection);
    } else if (props.mostRecent) {
      props.setCollection(props.mostRecent);
    }

    this.state = { showModal: false };
  }

  componentWillMount() {
    const { loadUserCollections, user } = this.props;
    if (user) {
      loadUserCollections(user.get('username'));
    }
  }

  componentWillReceiveProps(nextProps) {
    const { creatingCollection } = this.props;
    const { newCollection } = nextProps;

    // if incoming prop has a newCollection object and we are currently creating
    // a collection, close the modal and select the new collection
    if (creatingCollection && this.props.newCollection !== newCollection) {
      this.collectionChoice(newCollection);
      this.close();
    }
  }

  componentDidUpdate(prevProps) {
    const { activeCollection, fromCollection, mostRecent, setCollection } = this.props;

    if (!fromCollection && !this.props.loading && prevProps.loading && activeCollection !== mostRecent) {
      setCollection(mostRecent);
    } else if (fromCollection && fromCollection !== prevProps.fromCollection) {
      setCollection(fromCollection);
    }
  }

  collectionChoice = (id) => {
    // filter out new modal option
    if (id) {
      this.props.setCollection(id);
    }
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
    const { activeCollection, canCreateCollection, collections, collectionError, creatingCollection, label, user } = this.props;
    const { showModal } = this.state;

    const buttonTitle = activeCollection.title ? <span><WarcIcon /> {activeCollection.title}</span> : 'Add to Collection...';

    return (
      <div className="wr-collection-menu">
        {
          user && user.get('username') && !user.get('anon') &&
            <React.Fragment>
              {
                label &&
                  <label className="left-buffer" htmlFor="wr-collection-dropdown" dangerouslySetInnerHTML={{ __html: label }} />
              }
              <DropdownButton title={buttonTitle} id="wr-collection-dropdown" onSelect={this.collectionChoice}>
                {
                  canCreateCollection &&
                    <React.Fragment>
                      <MenuItem onClick={this.toggle}>+ Create new collection</MenuItem>
                      <MenuItem divider />
                    </React.Fragment>
                }
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
                        <WarcIcon /> { title }
                      </MenuItem>
                    );
                  })
                }
              </DropdownButton>
            </React.Fragment>
        }
        <NewCollection
          close={this.close}
          visible={showModal}
          createCollection={this.createCollection}
          creatingCollection={creatingCollection}
          error={collectionError} />
      </div>
    );
  }
}

export default CollectionDropdownUI;
