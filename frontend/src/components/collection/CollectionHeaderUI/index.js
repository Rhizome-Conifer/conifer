import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Button } from 'react-bootstrap';

import { defaultCollDesc } from 'config';

import InlineEditor from 'components/InlineEditor';
import WYSIWYG from 'components/WYSIWYG';

import './style.scss';


class CollectionHeaderUI extends Component {

  static contextTypes = {
    canAdmin: PropTypes.bool
  };

  static propTypes = {
    activeList: PropTypes.bool,
    collection: PropTypes.object,
    collSaveSuccess: PropTypes.bool,
    condensed: PropTypes.bool,
    list: PropTypes.object,
    listEdited: PropTypes.bool,
    saveDescription: PropTypes.func,
    listSaveSuccess: PropTypes.bool,
    saveListEdit: PropTypes.func
  };

  constructor(props) {
    super(props);

    this.handle = null;
    this.abbreviateThreshold = 75;
    this.state = {
      animated: false,
      condensed: false,
      toggleDesc: false,
      abbreviated: false,
      hoverOverride: false,
      height: 'auto'
    };
  }

  componentWillReceiveProps(nextProps) {
    if (this.state.hoverOverride && nextProps.condensed) {
      this.setState({ hoverOverride: false });
    }

    if (nextProps.condensed && !this.props.condensed) {
      const height = this.descContainer.getBoundingClientRect().height;
      this.setState({ height });
      setTimeout(() => this.setState({ condensed: true }), 10);
    } else if (this.props.condensed && !nextProps.condensed) {
      this.setState({ condensed: false });
      this.descContainer.addEventListener('transitionend', () => { this.setState({ height: 'auto' }); }, { once: true });
    }
  }

  editorRendered = () => {
    const h = this.descContainer.getBoundingClientRect().height;
    const state = { animated: true };

    if (h >= this.abbreviateThreshold) {
      state.abbreviated = true;
    }

    this.setState(state);
  }

  editTitle = (title) => {
    // TODO: connect to api
    console.log('saving..', title);
  }

  saveListTitle = (title) => {
    const { collection, list } = this.props;
    this.props.saveListEdit(collection.get('user'), collection.get('id'), list.get('id'), { title });
  }

  toggleDesc = () => {
    const { toggleDesc } = this.state;

    this.setState({ abbreviated: false, height: 'auto' });
  }

  hoverDelay = () => {
    this.handle = setTimeout(() => this.setState({ hoverOverride: true }), 250);
  }

  hoverCancel = () => {
    if (this.state.hoverOverride) {
      this.setState({ hoverOverride: false });
    }

    clearTimeout(this.handle);
  }

  saveDesc = (desc) => {
    const { activeList, collection, list, saveDescription, saveListEdit } = this.props;
    if (activeList) {
      saveListEdit(collection.get('user'), collection.get('id'), list.get('id'), { desc });
    } else {
      saveDescription(collection.get('user'), collection.get('id'), desc);
    }
  }

  render() {
    const { activeList, collection, collSaveSuccess, list, listEdited } = this.props;
    const { abbreviated, animated, condensed, height, hoverOverride, toggleDesc } = this.state;

    const containerClasses = classNames('wr-collection-header', {
      condensed: condensed && !hoverOverride && !toggleDesc,
      abbreviated,
      animated
    });

    return (
      <header
        className={containerClasses}
        onMouseEnter={this.hoverDelay}
        onMouseLeave={this.hoverCancel}>
        <InlineEditor
          initial={collection.get('title')}
          onSave={this.editTitle}>
          <h1>{collection.get('title')}</h1>
        </InlineEditor>
        {
          activeList &&
            <React.Fragment>
              <h1>&nbsp;>&nbsp;</h1>
              <InlineEditor
                initial={list.get('title')}
                onSave={this.saveListTitle}
                success={this.props.listEdited}>
                <h1>{list.get('title')}</h1>
              </InlineEditor>
            </React.Fragment>
        }
        <hr />
        <div
          ref={(obj) => { this.descContainer = obj; }}
          className={classNames('desc-container')}
          style={{ height }}>
          <WYSIWYG
            initial={activeList ? list.get('desc') : collection.get('desc') || defaultCollDesc}
            save={this.saveDesc}
            renderCallback={this.editorRendered}
            success={activeList ? listEdited : collSaveSuccess} />
          <button className="read-more borderless" onClick={this.toggleDesc}>Read More</button>
        </div>
      </header>
    );
  }
}


export default CollectionHeaderUI;
