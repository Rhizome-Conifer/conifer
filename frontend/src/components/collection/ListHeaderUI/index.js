import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Collapsible from 'react-collapsible';

import EditModal from 'components/collection/EditModal';
import WYSIWYG from 'components/WYSIWYG';
import { CarotIcon, ListIcon } from 'components/icons';

import './style.scss';


class ListHeaderUI extends Component {
  static contextTypes = {
    canAdmin: PropTypes.bool
  };

  static propTypes = {
    collection: PropTypes.object,
    editList: PropTypes.func,
    list: PropTypes.object,
    listEditing: PropTypes.bool,
    listEdited: PropTypes.bool,
    listError: PropTypes.bool,
    location: PropTypes.object
  };

  constructor(props) {
    super(props);

    this.state = {
      editModal: false,
      showDesc: false
    };
  }

  editList = (data) => {
    const { collection, editList, list } = this.props;
    editList(collection.get('owner'), collection.get('id'), list.get('id'), data);
  }

  editModal = () => {
    this.setState({ editModal: !this.state.editModal });
  }

  closeDesc = () => this.setState({ showDesc: false })

  openDesc = () => this.setState({ showDesc: true })

  render() {
    const { canAdmin } = this.context;
    const { list } = this.props;
    const { showDesc } = this.state;

    const trigger = (
      <div><CarotIcon flip={showDesc} /> {showDesc ? 'Hide' : 'Show'} Description</div>
    );

    return (
      <div className="wr-list-header">
        <div className={classNames('banner')}>
          <ListIcon />
          <h2 role={canAdmin ? 'button' : 'presentation'} className={classNames({ 'click-highlight': canAdmin })} onClick={canAdmin ? this.editModal : undefined}>{list.get('title')}</h2>
        </div>

        {
          (list.get('desc') || canAdmin) &&
            <Collapsible
              lazyRender
              easing="ease-in-out"
              onClose={this.closeDesc}
              onOpen={this.openDesc}
              overflowWhenOpen="visible"
              transitionTime={300}
              trigger={trigger}>
              <div role={canAdmin ? 'button' : 'presentation'} className={classNames({ 'click-highlight': canAdmin })} onClick={canAdmin ? this.editModal : undefined}>
                <WYSIWYG
                  readOnly
                  initial={list.get('desc') || '\\+ Add Description'}
                  key={list.get('id')} />
              </div>
            </Collapsible>
        }

        {
          canAdmin &&
            <EditModal
              closeCb={this.editModal}
              desc={list.get('desc')}
              editing={this.props.listEditing}
              edited={this.props.listEdited}
              editCallback={this.editList}
              error={this.props.listError}
              key={list.get('id')}
              label="List"
              name={list.get('title')}
              open={this.state.editModal}
              propsPass={{ key: 'listModal' }} />
        }
      </div>
    );
  }
}


export default ListHeaderUI;
