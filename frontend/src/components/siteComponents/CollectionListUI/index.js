import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { fromJS } from 'immutable';
import { Link } from 'react-router';
import { Button, Col, ProgressBar, Row } from 'react-bootstrap';
import { BreadcrumbsItem } from 'react-breadcrumbs-dynamic';
import Toggle from 'react-toggle';

import Modal from 'components/Modal';
import SizeFormat from 'components/SizeFormat';

import 'shared/scss/toggle.scss';
import './style.scss';


class CollectionListUI extends Component {
  static contextTypes = {
    router: PropTypes.object
  }

  static propTypes = {
    auth: PropTypes.object,
    collections: PropTypes.object,
    createNewCollection: PropTypes.func,
    orderedCollections: PropTypes.object,
    params: PropTypes.object,
    user: PropTypes.object
  };

  static defaultProps = fromJS({
    collections: []
  });

  constructor(props) {
    super(props);

    this.state = {
      showModal: false,
      isPublic: false,
      collTitle: 'New Collection'
    };
  }

  componentWillReceiveProps(nextProps) {
    const { collections, params: { user } } = this.props;
    const creatingCollection = collections.get('creatingCollection');
    const newCollection = nextProps.collections.get('newCollection');

    // if incoming prop has a newCollection object and we are currently creating
    // a collection, reroute to new collection
    if (newCollection && creatingCollection) {
      this.context.router.push(`/${user}/${newCollection}/`);
    }
  }

  createCollection = (evt) => {
    evt.preventDefault();

    const { createNewCollection, params: { user } } = this.props;
    const { collTitle, isPublic } = this.state;

    createNewCollection(user, collTitle, isPublic);
  }

  toggle = (evt) => {
    this.setState({ showModal: !this.state.showModal });
  }

  togglePublic = (evt) => {
    this.setState({ isPublic: !this.state.isPublic });
  }

  close = (evt) => {
    this.setState({ showModal: false });
  }

  handleInput = (evt) => {
    this.setState({ collTitle: evt.target.value });
  }

  render() {
    const { auth, collections, orderedCollections, params, user } = this.props;
    const { collTitle, isPublic, showModal } = this.state;
    const userParam = params.user;

    const canAdmin = auth.getIn(['user', 'username']) === userParam; // && !anon;
    const spaceUsed = user.getIn(['space_utilization', 'used']);
    const totalSpace = user.getIn(['space_utilization', 'total']);

    const creatingCollection = collections.get('creatingCollection');
    const newCollectionBody = (
      <form onSubmit={this.createCollection} id="create-coll" className="form-horizontal">
        <span className="form-group col-md-5">
          <label htmlFor="collection">Collection Name:</label>
          <input type="text" id="title" name="title" className="form-control" onChange={this.handleInput} value={collTitle} required />
        </span>

        <span className="col-md-6 col-md-offset-1">
          <div><label htmlFor="public-switch"><span className="glyphicon glyphicon-globe" style={{ marginRight: '4px' }} />Make public (visible to all)?</label></div>
          <Toggle
            id="public-switch"
            defaultChecked={isPublic}
            onChange={this.togglePublic} />
        </span>

        <button className="btn btn-lg btn-primary btn-block" type="submit" disabled={creatingCollection}>Create</button>
      </form>
    );

    return (
      <div>
        <BreadcrumbsItem to={`/${params.user}`}>{ params.user }</BreadcrumbsItem>
        <Row className="collection-description page-archive">
          <Col xs={12}>
            <h2>{ userParam } Archive</h2>
            <p>Available collections are listed below.</p>
          </Col>
        </Row>
        <Row>
          <Col xs={6} className="wr-coll-meta">
            {
              canAdmin &&
                <Button onClick={this.toggle} bsStyle="primary" bsSize="small">
                  <span className="glyphicon glyphicon-plus glyphicon-button" /> New Collection
                </Button>
            }
          </Col>
          {
            canAdmin &&
              <Col xs={2} className="pull-right">
                <strong>Space Used: </strong>
                <SizeFormat bytes={spaceUsed} />
                <ProgressBar now={(spaceUsed / totalSpace) * 100} bsStyle="success" />
              </Col>
          }
        </Row>

        {
          collections &&
            <Row>
              <ul className="list-group collection-list">
                {
                  orderedCollections.map(coll =>
                    <li className="left-buffer list-group-item" key={coll.get('id')}>
                      <Row>
                        <Col xs={9}>
                          <Link to={`${userParam}/${coll.get('id')}`} className="collection-title">{coll.get('title')}</Link>
                        </Col>
                        <Col xs={2}>
                          <SizeFormat bytes={coll.get('size')} />
                        </Col>
                        <Col xs={1}>
                          { coll.get('r:@public') === '1' &&
                            <span className="glyphicon glyphicon-globe" title="Public Collection &mdash; Visible to Everyone" />
                          }
                        </Col>
                      </Row>
                    </li>
                  )
                }
              </ul>
            </Row>
        }

        <Modal
          body={newCollectionBody}
          closeCb={this.close}
          header="Create New Collection"
          visible={showModal} />
      </div>
    );
  }
}


export default CollectionListUI;
