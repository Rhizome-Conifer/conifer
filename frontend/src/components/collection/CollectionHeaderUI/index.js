import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Toggle from 'react-toggle';
import { Button, ControlLabel, FormControl, FormGroup } from 'react-bootstrap';

import { defaultCollDesc, defaultListDesc } from 'config';

import { Upload } from 'containers';

import Modal from 'components/Modal';
import InlineEditor from 'components/InlineEditor';
import WYSIWYG from 'components/WYSIWYG';

import './style.scss';


class CollectionHeaderUI extends Component {

  static contextTypes = {
    canAdmin: PropTypes.bool,
    isAnon: PropTypes.bool
  };

  static propTypes = {
    activeList: PropTypes.bool,
    collection: PropTypes.object,
    collEdited: PropTypes.bool,
    collEditError: PropTypes.string,
    condensed: PropTypes.bool,
    deleteColl: PropTypes.func,
    list: PropTypes.object,
    listEdited: PropTypes.bool,
    editCollection: PropTypes.func,
    editList: PropTypes.func
  };

  constructor(props) {
    super(props);

    this.handle = null;
    this.truncateThreshold = 75;
    this.state = {
      animated: false,
      condensed: false,
      confirmDelete: '',
      deleteModal: false,
      toggleDesc: false,
      truncate: false,
      hoverOverride: false,
      height: 'auto'
    };
  }

  componentWillReceiveProps(nextProps) {
    if (this.state.hoverOverride && nextProps.condensed) {
      this.setState({ hoverOverride: false });
    }

    if (nextProps.condensed && !this.props.condensed && this.descContainer) {
      const height = this.descContainer.getBoundingClientRect().height;
      this.setState({ height });
      setTimeout(() => this.setState({ condensed: true }), 10);
    } else if (this.props.condensed && !nextProps.condensed) {
      this.setState({ condensed: false });
      this.descContainer.addEventListener('transitionend', () => { this.setState({ height: 'auto' }); }, { once: true });
    }
  }

  setPublic = () => {
    const { collection } = this.props;
    this.props.editCollection(collection.get('user'), collection.get('id'), { public: !(collection.get('isPublic') === '1') });
  }

  editorRendered = () => {
    if (!this.descContainer) {
      return;
    }

    const h = this.descContainer.getBoundingClientRect().height;
    const state = { animated: true };

    if (h >= this.truncateThreshold) {
      state.truncate = true;
    }

    this.setState(state);
  }

  handleChange = evt => this.setState({ [evt.target.name]: evt.target.value })

  editListTitle = (title) => {
    const { collection, list } = this.props;
    this.props.editList(collection.get('user'), collection.get('id'), list.get('id'), { title });
  }

  toggleDesc = () => {
    const { toggleDesc } = this.state;

    this.setState({ truncate: false, height: 'auto' });
  }

  editModeCallback = () => {
    if (this.state.condensed) {
      this.setState({ height: 'auto' });
    }
  }

  hoverDelay = () => {
    if (this.props.condensed && !this.state.hoverOverride) {
      this.handle = setTimeout(() => this.setState({ hoverOverride: true }), 250);
    }
  }

  hoverCancel = () => {
    if (this.state.hoverOverride) {
      this.setState({ hoverOverride: false });
    }

    clearTimeout(this.handle);
  }

  editCollTitle = (title) => {
    const { collection } = this.props;
    this.props.editCollection(collection.get('user'), collection.get('id'), { title });
  }

  editDesc = (desc) => {
    const { activeList, collection, list, editCollection, editList } = this.props;
    if (activeList) {
      editList(collection.get('user'), collection.get('id'), list.get('id'), { desc });
    } else {
      editCollection(collection.get('user'), collection.get('id'), { desc });
    }
  }

  toggleDeleteModal = () => this.setState({ deleteModal: !this.state.deleteModal })

  deleteCollection = () => {
    const { collection } = this.props;
    const { confirmDelete } = this.state;

    if (collection.get('title').match(new RegExp(`^${confirmDelete}$`, 'i'))) {
      this.props.deleteColl(collection.get('user'), collection.get('id'));
    }
  }

  validateConfirmDelete = (evt) => {
    const { collection } = this.props;
    const { confirmDelete } = this.state;

    if (!confirmDelete) {
      return null;
    }

    if (confirmDelete && !collection.get('title').match(new RegExp(`^${confirmDelete}$`, 'i'))) {
      return 'error';
    }

    return 'success';
  }

  render() {
    const { canAdmin, isAnon } = this.context;
    const { activeList, collection, collEdited, list, listEdited } = this.props;
    const { truncate, animated, condensed, height, hoverOverride, toggleDesc } = this.state;

    const containerClasses = classNames('wr-collection-header', {
      condensed: condensed && !hoverOverride && !toggleDesc,
      truncate,
      animated
    });

    return (
      <header
        className={containerClasses}
        onMouseEnter={this.hoverDelay}
        onMouseLeave={this.hoverCancel}>
        <div className="heading-row">
          <div className="heading-container">
            <InlineEditor
              initial={collection.get('title')}
              onSave={this.editCollTitle}
              success={collEdited}
              error={this.props.collEditError}>
              <h1>{collection.get('title')}</h1>
            </InlineEditor>
            {
              activeList &&
                <React.Fragment>
                  <h1>&nbsp;>&nbsp;</h1>
                  <InlineEditor
                    initial={list.get('title')}
                    onSave={this.editListTitle}
                    success={this.props.listEdited}>
                    <h1>{list.get('title')}</h1>
                  </InlineEditor>
                </React.Fragment>
            }
          </div>
          <div className="collection-tools">
            {
              !isAnon &&
                <div className="access-switch">
                  <span className="right-buffer-sm hidden-xs">Collection Public?</span>
                  <Toggle
                    icons={false}
                    defaultChecked={collection.get('isPublic') === '1'}
                    onChange={this.setPublic} />
                </div>
            }
            {
              canAdmin &&
                <Button bsSize="sm" bsStyle="success" onClick={() => { window.location = `/${collection.get('user')}/${collection.get('id')}/$download`; }}>
                  Download
                </Button>
            }
            {
              !isAnon &&
                <Upload fromCollection={collection.get('id')} classes="btn btn-sm btn-default">
                  upload
                </Upload>
            }
            {
              !isAnon &&
                <React.Fragment>
                  <Button bsStyle="danger" bsSize="sm" onClick={this.toggleDeleteModal}>
                    Delete Collection
                  </Button>
                  <Modal
                    visible={this.state.deleteModal}
                    closeCb={this.toggleDeleteModal}
                    dialogClassName="wr-delete-modal"
                    header={<h4>Confirm Delete Collection</h4>}
                    footer={
                      <React.Fragment>
                        <Button onClick={this.toggleDeleteModal} style={{ marginRight: 5 }}>Cancel</Button>
                        <Button onClick={this.deleteCollection} disabled={this.validateConfirmDelete() !== 'success'} bsStyle="danger">Confirm Delete</Button>
                      </React.Fragment>
                    }>
                    <p>Are you sure you want to delete the collection <b>{collection.get('title')}</b> {`/${collection.get('user')}/${collection.get('id')}/`}?</p>
                    <p>If you confirm, <b>all recordings will be permanently deleted</b>.</p>
                    <p>Be sure to download the collection first if you would like to keep any data.</p>
                    <FormGroup validationState={this.validateConfirmDelete()}>
                      <ControlLabel>Type the collection title to confirm:</ControlLabel>
                      <FormControl
                        id="confirm-delete"
                        type="text"
                        name="confirmDelete"
                        placeholder={collection.get('title')}
                        value={this.state.confirmDelete}
                        onChange={this.handleChange} />
                    </FormGroup>
                  </Modal>
                </React.Fragment>
            }
          </div>
        </div>
        <hr />
        <div
          ref={(obj) => { this.descContainer = obj; }}
          className={classNames('desc-container')}
          style={{ height }}>
          <WYSIWYG
            initial={activeList ? list.get('desc') || defaultListDesc : collection.get('desc') || defaultCollDesc}
            save={this.editDesc}
            renderCallback={this.editorRendered}
            toggleCallback={this.editModeCallback}
            success={activeList ? listEdited : collEdited} />
          <button className="read-more borderless" onClick={this.toggleDesc}>Read More</button>
        </div>
      </header>
    );
  }
}


export default CollectionHeaderUI;
