import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';
import classNames from 'classnames';
import { fromJS } from 'immutable';
import { Button, Col, Row } from 'react-bootstrap';

import { stopPropagation } from 'helpers/utils';

import { StandaloneRecorder } from 'containers';

import HttpStatus from 'components/HttpStatus';
import InlineEditor from 'components/InlineEditor';
import RedirectWithStatus from 'components/RedirectWithStatus';
import WYSIWYG from 'components/WYSIWYG';
import { NewCollection } from 'components/siteComponents';
import { Upload } from 'containers';
import { LinkIcon, UploadIcon } from 'components/icons';

import CollectionItem from './CollectionItem';
import './style.scss';


class CollectionListUI extends Component {
  static contextTypes = {
    isAnon: PropTypes.bool
  };

  static propTypes = {
    auth: PropTypes.object,
    collections: PropTypes.object,
    createNewCollection: PropTypes.func,
    edited: PropTypes.bool,
    editCollection: PropTypes.func,
    editUser: PropTypes.func,
    orderedCollections: PropTypes.object,
    match: PropTypes.object,
    history: PropTypes.object,
    user: PropTypes.object
  };

  static defaultProps = fromJS({
    collections: []
  });

  constructor(props) {
    super(props);

    this.state = {
      showModal: false
    };
  }

  createCollection = (collTitle, isPublic) => {
    const { createNewCollection, match: { params: { user } } } = this.props;
    createNewCollection(user, collTitle, isPublic);
  }

  editName = (full_name) => {
    const { editUser, match: { params: { user } } } = this.props;
    editUser(user, { full_name });
  }

  editURL = (display_url) => {
    const { editUser, match: { params: { user } } } = this.props;
    editUser(user, { display_url });
  }

  toggle = () => {
    this.setState({ showModal: !this.state.showModal });
  }

  close = () => {
    this.setState({ showModal: false });
  }

  updateUser = (description) => {
    const { editUser, match: { params: { user } } } = this.props;
    editUser(user, { desc: description });
  }

  render() {
    const { isAnon } = this.context;
    const { auth, collections, editCollection, history, orderedCollections, match: { params }, user } = this.props;
    const { showModal } = this.state;
    const userParam = params.user;
    const displayName = user.get('full_name') || userParam;
    const canAdmin = auth.getIn(['user', 'username']) === userParam;

    const userLink = user.get('display_url') && (!user.get('display_url').match(/^[a-zA-Z]+:\/\//) ? `http://${user.get('display_url')}` : user.get('display_url'));


    if (collections.get('error') && !collections.get('creatingCollection')) {
      return (
        <HttpStatus>
          {collections.getIn(['error', 'error_message'])}
        </HttpStatus>
      );
    }

    if (collections.get('loaded') && isAnon && canAdmin) {
      return <RedirectWithStatus to={`/${auth.getIn(['user', 'username'])}/temp/manage`} status={301} />;
    }

    return (
      <React.Fragment>
        <Helmet>
          <title>{`${displayName}'s Collections`}</title>
        </Helmet>
        <Row>
          {
            !__DESKTOP__ &&
              <Col xs={12} sm={3} className="collection-description">
                <InlineEditor
                  canAdmin={canAdmin}
                  initial={displayName}
                  onSave={this.editName}
                  readOnly={isAnon || !canAdmin}
                  success={this.props.edited}>
                  <h2>{displayName}</h2>
                </InlineEditor>
                <p className="collection-username"><span className="glyphicon glyphicon-user right-buffer-sm" />{ userParam }</p>
                {
                  (user.get('display_url') || canAdmin) &&
                    <InlineEditor
                      canAdmin={canAdmin}
                      initial={user.get('display_url') || 'Add website...'}
                      placeholder="Add website..."
                      onSave={this.editURL}
                      readOnly={isAnon || !canAdmin}
                      success={this.props.edited}>
                      <div className="user-link">
                        <a target="_blank" onClick={stopPropagation} href={userLink}><LinkIcon />
                          <span>{user.get('display_url') || 'Add website...'}</span>
                        </a>
                      </div>
                    </InlineEditor>
                }
                <WYSIWYG
                  key={user.get('id')}
                  initial={user.get('desc') || ''}
                  onSave={this.updateUser}
                  placeholder="Add a description..."
                  clickToEdit
                  readOnly={isAnon || !canAdmin}
                  success={this.props.edited} />
              </Col>
          }
          <Col xs={12} sm={__DESKTOP__ ? 10 : 9} smOffset={__DESKTOP__ ? 1 : 0} className="wr-coll-meta">
            {
              canAdmin &&
                <Row className="collection-start-form">
                  <Col className="start-form" xs={12}>
                    <h4>New Capture</h4>
                    <StandaloneRecorder />
                  </Col>
                </Row>
            }
            {
              !isAnon && canAdmin &&
                <Row>
                  <Col xs={12} className={classNames('collections-index-nav', { desktop: __DESKTOP__ })}>
                    { __DESKTOP__ && <h4>My Collections</h4> }
                    <Button onClick={this.toggle} className="rounded">
                      <span className="glyphicon glyphicon-plus glyphicon-button" /> New Collection
                    </Button>
                    <Upload classes="rounded">
                      <UploadIcon /> { __DESKTOP__ ? 'Import' : 'Upload' }
                    </Upload>
                  </Col>
                </Row>
            }
            {
              collections && collections.get('loaded') &&
                <Row>
                  <ul className="list-group collection-list">
                    {
                      orderedCollections.map((coll) => {
                        return (
                          <CollectionItem
                            key={coll.get('id')}
                            canAdmin={canAdmin}
                            collection={coll}
                            editCollection={editCollection}
                            history={history} />
                        );
                      })
                    }
                  </ul>
                </Row>
            }
          </Col>
        </Row>
        <NewCollection
          close={this.close}
          visible={showModal}
          createCollection={this.createCollection}
          creatingCollection={collections.get('creatingCollection')}
          error={collections.get('error')} />
      </React.Fragment>
    );
  }
}


export default CollectionListUI;
