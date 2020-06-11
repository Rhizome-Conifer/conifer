import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import removeMd from 'remove-markdown';
import classNames from 'classnames';
import { Link } from 'react-router-dom';
import { Button, Col, OverlayTrigger, Row, Tooltip } from 'react-bootstrap';

import { buildDate, getCollectionLink, truncate } from 'helpers/utils';

import SizeFormat from 'components/SizeFormat';
import { DeleteCollection } from 'containers';
import { TrashIcon, PlusIcon } from 'components/icons';

class CollectionItem extends PureComponent {
  static propTypes = {
    canAdmin: PropTypes.bool,
    addToList: PropTypes.func,
    collId: PropTypes.string,
    collUser: PropTypes.string,
    editCollection: PropTypes.func,
    id: PropTypes.string,
    isOver: PropTypes.bool,
    collection: PropTypes.object,
    selected: PropTypes.bool,
    history: PropTypes.string
  };

  manageCollection = () => {
    const { collection, history } = this.props;
    history.push(getCollectionLink(collection, true));
  }

  newSession = () => {
    const { collection, history } = this.props;
    history.push(`${getCollectionLink(collection)}/$new`);
  }

  toggleVisibility = () => {
    const { collection } = this.props;
    this.props.editCollection(collection.get('owner'), collection.get('id'), { public: !collection.get('public') });
  }

  render() {
    const { canAdmin, collection } = this.props;
    const descClasses = classNames('left-buffer list-group-item', { 'has-description': collection.get('desc') });

    const deleteBtn = (
      <OverlayTrigger
        placement="top"
        overlay={
          <Tooltip id="tooltip-top">
            DELETE
          </Tooltip>
        }>
        <Button variant="link"><TrashIcon /></Button>
      </OverlayTrigger>
    );

    return (
      <li className={descClasses} key={collection.get('id')}>
        <Row>
          <Col sm={12} md={9} lg={7}>
            <Link className="collection-title" to={`${getCollectionLink(collection)}`}>{collection.get('title')}</Link>
            <p className="collection-list-description">
              {
                truncate(removeMd(collection.get('desc'), { useImgAltText: false }), 3, new RegExp(/([.!?])/))
              }
            </p>
            {
              canAdmin &&
                <React.Fragment>
                  <Button size="lg" variant="outline-secondary" onClick={this.manageCollection}>
                    Manage Collection
                  </Button>
                  <Button size="lg" variant="outline-secondary" onClick={this.newSession}><PlusIcon /> New Session</Button>
                </React.Fragment>
            }
          </Col>
          <Col lg={1} className="collection-list-size d-none d-lg-block">
            <SizeFormat bytes={collection.get('size')} />
          </Col>
          <Col className="collection-time d-none d-lg-block" lg={2}>
            Created {buildDate(collection.get('created_at'), false, true)}
          </Col>
          <Col className="collection-delete-action d-none d-md-flex" md={3} lg={2}>
            {
              canAdmin &&
                <React.Fragment>
                  {
                    !__DESKTOP__ &&
                      <span className={classNames('visibility-button', { 'is-public': collection.get('public') })}>
                        { collection.get('public') ? 'PUBLIC' : 'PRIVATE' }
                      </span>
                  }
                  <DeleteCollection collection={collection} trigger={deleteBtn} />
                </React.Fragment>
            }
          </Col>
        </Row>
      </li>
    );
  }
}

export default CollectionItem;
