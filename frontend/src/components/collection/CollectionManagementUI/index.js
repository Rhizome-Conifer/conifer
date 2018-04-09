import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'react-bootstrap';

import SessionCollapsible from 'components/collection/SessionCollapsible';

import './style.scss';


class CollectionManagementUI extends Component {
  static propTypes = {
    auth: PropTypes.object,
    collection: PropTypes.object,
    deleteRec: PropTypes.func,
    recordings: PropTypes.object,
    loaded: PropTypes.bool
  };

  constructor(props) {
    super(props);

    this.state = {
      expandAll: false
    };
  }

  toggleAll = () => {
    this.setState({ expandAll: !this.state.expandAll });
  }

  render() {
    const { collection, recordings } = this.props;
    const { expandAll } = this.state;

    return (
      <div className="wr-coll-mgmt">
        <header>
          <h4>Collection Management</h4>
          <Button bsSize="sm" onClick={this.toggleAll}>
            { expandAll ? 'Collapse All' : 'Show All' }
          </Button>
        </header>
        {
          recordings.map((rec) => {
            return (
              <SessionCollapsible
                key={rec.get('id')}
                deleteRec={this.props.deleteRec}
                collection={collection}
                expand={expandAll}
                recording={rec}
                onSelectRow={this.onSelectGroupedRow} />
            );
          })
        }
      </div>
    );
  }
}


export default CollectionManagementUI;
