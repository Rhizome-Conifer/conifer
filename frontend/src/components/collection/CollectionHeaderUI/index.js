import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Link } from 'react-router-dom';
import { Alert, Button, DropdownButton, MenuItem } from 'react-bootstrap';

import { defaultCollDesc } from 'config';

import { DeleteCollection, Upload } from 'containers';

import Capstone from 'components/collection/Capstone';
import InlineEditor from 'components/InlineEditor';
import PublicSwitch from 'components/collection/PublicSwitch';
import WYSIWYG from 'components/WYSIWYG';
import { MoreIcon } from 'components/icons';

import './style.scss';


class CollectionHeaderUI extends Component {

  static contextTypes = {
    asPublic: PropTypes.bool,
    canAdmin: PropTypes.bool,
    isAnon: PropTypes.bool
  };

  static propTypes = {
    collection: PropTypes.object,
    collEdited: PropTypes.bool,
    collEditError: PropTypes.string,
    condensed: PropTypes.bool,
    deleteColl: PropTypes.func,
    history: PropTypes.object,
    editCollection: PropTypes.func
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
    this.props.editCollection(collection.get('user'), collection.get('id'), { public: !collection.get('public') });
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

  toggleDesc = () => {
    const { toggleDesc } = this.state;

    this.setState({ truncate: false, height: 'auto' });
  }

  editModeCallback = () => {
    if (this.state.condensed) {
      this.setState({ height: 'auto' });
    }
  }

  editCollTitle = (title) => {
    const { collection } = this.props;
    this.props.editCollection(collection.get('user'), collection.get('id'), { title });
  }

  editDesc = (desc) => {
    const { collection, editCollection } = this.props;
    editCollection(collection.get('user'), collection.get('id'), { desc });
  }

  newCapture = () => {
    const { collection, history } = this.props;
    history.push(`/${collection.get('user')}/${collection.get('id')}/$new`);
  }

  manageCollection = () => {
    const { collection, history } = this.props;
    history.push(`/${collection.get('user')}/${collection.get('id')}/management`);
  }

  downloadCollection = () => {
    const { collection } = this.props;
    window.location = `/${collection.get('user')}/${collection.get('id')}/$download`;
  }

  howTo = () => {
    const { history } = this.props;
    history.push('/_documentation');
  }

  togglePublicView = () => {
    const { collection, history } = this.props;
    history.push(`/${collection.get('user')}/${collection.get('id')}`);
    // const { location: { pathname, search }} = this.props;
    // const asPublic = search && search.indexOf('asPublic') !== -1;
    // if (asPublic) {
    //   window.location = `${pathname}${search.replace(/(\?|\&)asPublic/, '')}`;
    // } else {
    //   window.location = `${pathname}${search}${search.indexOf('?') !== -1 ? '&' : '?'}asPublic`;
    // }
  }

  render() {
    const { asPublic, canAdmin, isAnon } = this.context;
    const { collection, collEdited } = this.props;
    const { truncate, animated, condensed, height, hoverOverride, toggleDesc } = this.state;

    const containerClasses = classNames('wr-collection-header', {
      condensed: condensed && !hoverOverride && !toggleDesc,
      truncate,
      animated
    });

    const publicLists = collection.get('lists').reduce((sum, l) => (l.get('public') | 0) + sum, 0);
    const isPublic = collection.get('public');

    return (
      <header className={containerClasses}>
        {
          asPublic &&
            <Alert bsStyle="warning">
              Viewing collection as a public user. <Button bsSize="xs" onClick={this.togglePublicView}>return to owner view</Button>
            </Alert>
        }
        <div className={classNames('heading-row', { 'is-public': !canAdmin })}>
          <Capstone user={collection.get('user')} />
          <div className="heading-container">
            {
              canAdmin &&
                <div className="coll-status">
                  <PublicSwitch isPublic={isPublic} callback={this.setPublic} />
                  <span className="public-lists">{`${publicLists} Published List${publicLists === 1 ? '' : 's'}`}</span>
                </div>
            }
            <InlineEditor
              initial={collection.get('title')}
              onSave={this.editCollTitle}
              success={collEdited}
              error={this.props.collEditError}>
              <h1>{collection.get('title')}</h1>
            </InlineEditor>
          </div>
          {
            canAdmin &&
              <div className="utility-row">
                <Button className="rounded" onClick={this.togglePublicView}>See Public View</Button>
                <DropdownButton pullRight={condensed} id="coll-menu" noCaret className="rounded" title={<MoreIcon />}>
                  <MenuItem onClick={this.newCapture}>New Capture</MenuItem>
                  <MenuItem divider />
                  <MenuItem onClick={this.togglePublicView}>See Public View</MenuItem>
                  <MenuItem divider />
                  <MenuItem onClick={this.manageCollection}>Manage Collection Contents</MenuItem>
                  <Upload classes="" wrapper={MenuItem}>Upload To Collection</Upload>
                  <MenuItem onClick={this.downloadCollection}>Download Collection</MenuItem>
                  <DeleteCollection wrapper={MenuItem}>Delete Collection</DeleteCollection>
                  {/* TODO:
                  <MenuItem divider />
                  <MenuItem>Edit Collection Info</MenuItem>
                  */}
                  <MenuItem divider />
                  <MenuItem onClick={this.howTo}>Help</MenuItem>
                </DropdownButton>
              </div>
          }
        </div>
        <div
          ref={(obj) => { this.descContainer = obj; }}
          className={classNames('desc-container')}
          style={{ height }}>
          <WYSIWYG
            initial={collection.get('desc') || defaultCollDesc}
            onSave={this.editDesc}
            renderCallback={this.editorRendered}
            toggleCallback={this.editModeCallback}
            success={collEdited} />
          <button className="read-more borderless" onClick={this.toggleDesc}>show More</button>
        </div>
      </header>
    );
  }
}


export default CollectionHeaderUI;
