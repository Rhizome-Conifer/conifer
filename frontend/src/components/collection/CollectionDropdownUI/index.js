import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { List } from 'immutable';
import { Dropdown } from 'react-bootstrap';

import { doubleRAF } from 'helpers/utils';

import { NewCollection } from 'components/siteComponents';
import { WarcIcon } from 'components/icons';

import './style.scss';


class CollectionDropdownUI extends Component {
  static propTypes = {
    activeCollection: PropTypes.object,
    auth: PropTypes.object,
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
    setCollectionCallback: PropTypes.func,
    size: PropTypes.string
  };

  static defaultProps = {
    canCreateCollection: true,
    collections: List(),
    label: 'Add to collection:&emsp;',
    size: ''
  };

  constructor(props) {
    super(props);

    // prepouplate collection
    if (props.fromCollection) {
      props.setCollection(props.fromCollection);
    } else if (props.mostRecent) {
      props.setCollection(props.mostRecent);
    }

    this.state = {
      collections: props.collections,
      filter: '',
      showModal: false
    };

    const { loadUserCollections, auth } = props;
    if (auth.getIn(['user', 'username']) && !auth.getIn(['user', 'anon']) && Date.now() - auth.get('accessed') > 10000) {
      loadUserCollections(auth.getIn(['user', 'username']));
    }
  }

  componentDidUpdate(prevProps) {
    const { activeCollection, collections, fromCollection, mostRecent, newCollection, setCollection } = this.props;
    const { filter } = this.state;

    if (!fromCollection && !this.props.loading && prevProps.loading && activeCollection.id !== mostRecent) {
      setCollection(mostRecent);
    } else if (fromCollection && fromCollection !== prevProps.fromCollection) {
      setCollection(fromCollection);
    }

    // if incoming prop has a newCollection object and we are currently creating
    // a collection, close the modal and select the new collection
    if (prevProps.creatingCollection && prevProps.newCollection !== newCollection) {
      this.collectionChoice(newCollection);
      this.close();
    }

    if (collections !== prevProps.collections) {
      this.setState({
        collections: !filter ? collections : collections.filter(c => c.get('title').toLowerCase().indexOf(filter) !== -1)
      });
    }
  }

  collectionChoice = (id) => {
    // filter out new modal option
    if (id) {
      if (this.props.setCollectionCallback) {
        return this.props.setCollectionCallback(id);
      }
      this.props.setCollection(id);
    }
  }

  captureClick = (evt) => {
    evt.preventDefault();
    evt.stopPropagation();
  }

  close = () => {
    this.setState({ showModal: false });
  }

  createCollection = (collTitle, isPublic) => {
    const { auth, createNewCollection } = this.props;

    createNewCollection(auth.getIn(['user', 'username']), collTitle, isPublic);
  }

  dropdownToggle = (isOpen) => {
    if (isOpen) {
      doubleRAF(() => {
        if (this.filterInput) {
          this.filterInput.focus();

          if (this.state.filter) {
            this.filterInput.setSelectionRange(0, this.state.filter.length);
          }
        }
      });
    }
  }

  filterCollections = (evt) => {
    evt.preventDefault();
    evt.stopPropagation();
    const { collections } = this.props;

    this.setState({
      [evt.target.name]: evt.target.value,
      collections: !evt.target.value ? collections : collections.filter(c => c.get('title').toLowerCase().indexOf(evt.target.value) !== -1)
    });
  }

  keydown = (evt) => {
    // block spacebar from triggering dropdown
    if (evt.keyCode === 32) {
      evt.stopPropagation();
    }
  }

  toggle = () => {
    this.setState({ showModal: !this.state.showModal });
  }

  render() {
    const { auth, activeCollection, canCreateCollection, collectionError, creatingCollection, label } = this.props;
    const { showModal } = this.state;
    const user = auth.get('user');

    return (
      <div className="wr-collection-menu">
        {
          user && user.get('username') && !user.get('anon') &&
            <React.Fragment>
              {
                label &&
                  <label className="left-buffer" htmlFor="wr-collection-dropdown" dangerouslySetInnerHTML={{ __html: label }} />
              }
              <Dropdown
                id="wr-collection-dropdown"
                onSelect={this.collectionChoice}
                onToggle={this.dropdownToggle}>
                <Dropdown.Toggle block variant="outline-secondary" size={this.props.size}>
                  {activeCollection.title ? <span><WarcIcon /> {activeCollection.title}</span> : 'Add to Collection...'}
                </Dropdown.Toggle>

                <Dropdown.Menu>
                  {
                    canCreateCollection &&
                      <Dropdown.Item key="new-collection" onClick={this.toggle}>+ Create new collection</Dropdown.Item>
                  }
                  {
                    <Dropdown.Item key="filter">
                      <input
                        autoComplete="off"
                        className="form-control"
                        name="filter"
                        onKeyDown={this.keydown}
                        onChange={this.filterCollections}
                        onClick={this.captureClick}
                        placeholder="Filter collections..."
                        ref={(obj) => { this.filterInput = obj; }}
                        type="text"
                        aria-label="filter collections"
                        value={this.state.filter} />
                    </Dropdown.Item>
                  }
                  <Dropdown.Divider key="divider" />
                  {
                    this.state.collections.map((coll) => {
                      const id = coll.get('id');
                      const title = coll.get('title');

                      return (
                        <Dropdown.Item
                          key={id}
                          eventKey={id}
                          className={title.length > 50 ? 'make-wrap' : ''}
                          active={activeCollection.id === id}>
                          <WarcIcon /> { title }
                        </Dropdown.Item>
                      );
                    })
                  }
                  {
                    this.state.collections.size === 0 &&
                      <Dropdown.Item disabled>
                        No collections found...
                      </Dropdown.Item>
                  }
                </Dropdown.Menu>
              </Dropdown>
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
