import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import removeMd from 'remove-markdown';
import classNames from 'classnames';
import { Link } from 'react-router-dom';
import { Button, Col, Row, Tooltip } from 'react-bootstrap';

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

    return (
      <li className={descClasses} key={collection.get('id')}>
        <Row>
          <Col sm={12} md={7}>
            <Link className="collection-title" to={`${getCollectionLink(collection)}`}>{collection.get('title')}</Link>
            <p className="collection-list-description">
              {
                truncate(removeMd(collection.get('desc'), { useImgAltText: false }), 3, new RegExp(/([.!?])/))
              }
            </p>
            {
              canAdmin &&
                <React.Fragment>
                  <Button className="rounded" onClick={this.manageCollection}>
                    Manage Collection
                  </Button>
                  <Button className="rounded" onClick={this.newSession}><PlusIcon /> New Session</Button>
                </React.Fragment>
            }
          </Col>
          <Col xs={6} md={1} className="collection-list-size">
            <SizeFormat bytes={collection.get('size')} />
          </Col>
          <Col className="collection-time" xs={6} md={2}>
            Created {buildDate(collection.get('created_at'), false, true)}
          </Col>
          <Col className="collection-delete-action col-xs-offset-7 col-md-offset-0" xs={5} md={2}>
            {
              canAdmin &&
                <React.Fragment>
                  <span className={classNames('visibility-button', { 'is-public': collection.get('public') })}>
                    { collection.get('public') ? 'PUBLIC' : 'PRIVATE' }
                  </span>
                  <DeleteCollection collection={collection}>
                    <TrashIcon />
                    <Tooltip placement="top" className="in" id="tooltip-top">
                      DELETE
                    </Tooltip>
                  </DeleteCollection>
                </React.Fragment>
            }
          </Col>
        </Row>
      </li>
    );
  }
}

export default CollectionItem;
