import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Toggle from 'react-toggle';
import { Link } from 'react-router-dom';
import { Button } from 'react-bootstrap';

import Modal from 'components/Modal';
import Searchbox from 'components/Searchbox';


class CollectionFiltersUI extends Component {
  static contextTypes = {
    canAdmin: PropTypes.bool
  };

  static propTypes = {
    activeList: PropTypes.bool,
    addPagesToLists: PropTypes.func,
    collection: PropTypes.object,
    dispatch: PropTypes.func,
    expandAll: PropTypes.bool,
    groupDisplay: PropTypes.bool,
    onToggle: PropTypes.func,
    openAddToList: PropTypes.func,
    pages: PropTypes.object,
    toggleExpandAllSessions: PropTypes.func,
    search: PropTypes.func,
    searchText: PropTypes.string,
    searchPages: PropTypes.func,
    selectedPageIdx: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.array
    ])
  };

  constructor(props) {
    super(props);

    this.state = {
      addToListModal: false,
      checkedLists: {},
    };
  }


  addToList = () => {
    const { checkedLists } = this.state;
    const { collection, pages, selectedPageIdx } = this.props;

    if (!checkedLists || Object.entries(checkedLists).length === 0 || !selectedPageIdx) {
      return;
    }

    const selectedLists = Object.entries(checkedLists).filter(l => l[1]);
    const lists = selectedLists.map(obj => obj[0]);

    const pagesToAdd = [];

    if (typeof selectedPageIdx === 'object') {
      for(const pgIdx of selectedPageIdx) {
        pagesToAdd.push(pages.get(pgIdx).toJS());
      }
    } else {
      pagesToAdd.push(pages.get(selectedPageIdx).toJS());
    }

    this.props.addPagesToLists(collection.get('user'), collection.get('id'), pagesToAdd, lists);
    this.closeAddToList();
  }

  listCheckbox = (evt) => {
    const { checkedLists } = this.state;

    checkedLists[evt.target.name] = evt.target.checked;

    this.setState({ checkedLists });
  }

  openAddToList = () => this.setState({ addToListModal: true })
  closeAddToList = () => this.setState({ addToListModal: false })

  search = (evt) => {
    const { dispatch, groupDisplay, onToggle, searchPages } = this.props;

    // if in group mode, switch to flat display
    if(groupDisplay) {
      onToggle();
    }

    dispatch(searchPages(evt.target.value));
  }

  render() {
    const { canAdmin, isAnon } = this.context;
    const { activeList, collection, groupDisplay, onToggle } = this.props;

    return (
      <div className="wr-coll-utilities">
        <nav>
          {
            canAdmin &&
              <Link to={`/${collection.get('user')}/${collection.get('id')}/$new`}>
                <Button bsSize="xs" bsStyle="success">New Recording</Button>
              </Link>
          }
          {
            !activeList &&
              <div className="toggle-label">
                <span onClick={onToggle}>Group by session</span>
                <Toggle
                  checked={groupDisplay}
                  onChange={onToggle}
                  icons={false} />
              </div>
          }
          {
            !isAnon && canAdmin && this.props.selectedPageIdx &&
              <button className="open-all" onClick={this.openAddToList}>Add selection to lists</button>
          }
          {
            groupDisplay &&
              <button className="open-all" onClick={this.props.toggleExpandAllSessions}>{this.props.expandAll ? 'Close' : 'Open'} All Sessions</button>
          }
          {
            !activeList &&
              <Searchbox search={this.search} searchText={this.props.searchText} />
          }

          {
            canAdmin &&
              <Modal
                visible={this.state.addToListModal}
                closeCb={this.closeAddToList}
                dialogClassName="add-to-lists-modal"
                header={<h4>Add to ...</h4>}
                footer={
                  <React.Fragment>
                    <Button disabled style={{ marginRight: 5 }}>Create new list</Button>
                    <Button onClick={this.addToList} bsStyle="success">Save</Button>
                  </React.Fragment>
                }>
                <ul>
                  {
                    collection.get('lists').map((listObj) => {
                      const id = listObj.get('id');
                      return (
                        <li key={id}>
                          <input type="checkbox" onChange={this.listCheckbox} name={id} id={`add-to-list-${id}`} checked={this.state.checkedLists[id] || false} />
                          <label htmlFor={`add-to-list-${id}`}>{listObj.get('title')}</label>
                        </li>
                      );
                    })
                  }
                </ul>
              </Modal>
          }
        </nav>
      </div>
    );
  }
}

export default CollectionFiltersUI;
