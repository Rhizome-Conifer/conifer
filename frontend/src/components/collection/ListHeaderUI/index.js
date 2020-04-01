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
    clearSort: PropTypes.func,
    collection: PropTypes.object,
    editList: PropTypes.func,
    list: PropTypes.object,
    listEditing: PropTypes.bool,
    listEdited: PropTypes.bool,
    listError: PropTypes.bool,
    location: PropTypes.object,
    ordererdBookmarks: PropTypes.array,
    saveBookmarkSort: PropTypes.func,
    sort: PropTypes.object
  };

  constructor(props) {
    super(props);

    this.state = {
      editModal: false,
      showDesc: false
    };
  }

  editList = (data) => {
    const { editList, list } = this.props;
    editList(list.get('id'), data);
  }

  editModal = () => {
    this.setState({ editModal: !this.state.editModal });
  }

  closeDesc = () => this.setState({ showDesc: false })

  openDesc = () => this.setState({ showDesc: true })

  saveSort = () => {
    const { list, ordererdBookmarks, saveBookmarkSort } = this.props;
    const order = ordererdBookmarks.map(o => o.get('id')).toArray();
    saveBookmarkSort(list.get('id'), order);
  }

  render() {
    const { canAdmin } = this.context;
    const { list, sort } = this.props;
    const { showDesc } = this.state;
    const sorted = sort.get('sort') !== null;

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
          <div className="list-metadata">
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
                <div className={classNames('list-sort-actions', { fade: !sorted })}>
                  <button className="rounded" disabled={!sorted} onClick={this.saveSort} type="button">save this ordering</button>
                  <button className="rounded" disabled={!sorted} onClick={this.props.clearSort} type="button">remove sort</button>
                </div>
            }
          </div>
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
