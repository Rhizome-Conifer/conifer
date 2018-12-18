import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Dropdown, MenuItem } from 'react-bootstrap';

import { getCollectionLink } from 'helpers/utils';

import { CollectionDropdown } from 'containers';

import './style.scss';


class AdminHeaderUI extends PureComponent {
  static propTypes = {
    collection: PropTypes.object,
    history: PropTypes.object,
    managing: PropTypes.bool
  };

  goToManager = () => {
    const { collection, history } = this.props;
    history.push(getCollectionLink(collection, true));
  }

  goToCollection = (id) => {
    const { collection, history } = this.props;
    history.push(`/${collection.get('owner')}/${id}/manage`);
  }

  render() {
    const { collection, managing } = this.props;
    if (managing) {
      return (
        <React.Fragment>
          <div className="managing-collection">
            Collection Manager:
          </div>
          <CollectionDropdown
            label={false}
            canCreateCollection={false}
            fromCollection={collection.get('id')}
            setCollectionCallback={this.goToCollection} />
        </React.Fragment>
      );
    }

    return (
      <React.Fragment>
        <button className="rounded collection-manager" onClick={this.goToManager} type="button">
          <span className="caret" />
          Collection Manager
        </button>
        <span className="active-collection">{collection.get('title')}</span>
        {
          collection.get('public') &&
            <span className="visibility-badge">PUBLIC</span>
        }
      </React.Fragment>
    );
  }
}


export default AdminHeaderUI;
