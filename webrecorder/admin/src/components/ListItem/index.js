import React, { Component, PropTypes } from 'react';
import { Row, Col } from 'react-bootstrap';
import { Link } from 'react-router';

import './style.scss';


class ListItem extends Component {

  static propTypes = {
    item: PropTypes.object,
    keys: PropTypes.arrayOf(PropTypes.object),
  }

  render() {
    const { item, keys } = this.props;

    return (
      <Row className='list-item'>
        {
          keys.map((key, idx) => {
            const val = key.format ? key.format(item[key.id]) : item[key.id];
            return (
                <Col
                  className={key.cl}
                  xs={key.xs}
                  sm={key.sm}
                  md={key.md}
                  key={idx}>
                    {
                      key.ln ?
                        <Link to={key.ln(item)} children={val} /> :
                        (key.component ? key.component(item) : val)
                    }
                </Col>
            );
          })
        }
      </Row>
    );
  }
}

export default ListItem;
