import React, { Component, PropTypes } from 'react';
import filter from 'lodash/filter';
import { Table, Thead, Th, Tr, Td } from 'reactable';
import { Link } from 'react-router';

import './style.scss';


class List extends Component {

  static propTypes = {
    uniqueKey: PropTypes.string,
    keys: PropTypes.arrayOf(PropTypes.object),
    items: PropTypes.arrayOf(PropTypes.object),
    filterFn: PropTypes.func,
    emptyMsg: PropTypes.string,
  }

  static defaultProps = {
    filterFn: null,
    emptyMsg: '0 items',
  }

  render() {
    const { emptyMsg, filterFn, items, keys, uniqueKey } = this.props;

    return (
      <Table
        className='wr-user-table'
        noDataText={emptyMsg}
        sortable={filter(keys, 'sortable').map(k => {
          const column=k.label ? k.label:k.id;
          return k.sortFunction ?
            {column, sortFunction: k.sortFunction} :
            column
        })}
        onSort={filterFn}>
        <Thead>
          {
            keys.map(key => {
              const label = key.label ? key.label : key.id;
              return (
                <Th
                  key={label}
                  column={label}
                  className={key.cl}>
                    {label}
                </Th>
              );
            })
          }
        </Thead>
        {
          items &&
            items.map( item =>
              <Tr key={item[uniqueKey]}>
                {
                  keys.map((key, idx) => {
                    const val = key.format ? key.format(item[key.id]) : item[key.id];
                    const href = key.ln ? key.ln(item):'';
                    const rel = href ? href.startsWith('/admin') : null;
                    return (
                        <Td
                          key={idx}
                          column={key.label ? key.label : key.id}
                          value={val}
                          className={key.cl}>
                            {
                              key.ln ?
                                ( rel ?
                                    <Link to={href}>{val}</Link> :
                                    <a href={href} target='_blank'>{val}</a>
                                ) :
                                (key.component ? key.component(item) : <span>{val}</span>)
                            }
                        </Td>
                    );
                  })
                }
              </Tr>
            )
        }
      </Table>
    );
  }
}

export default List;
