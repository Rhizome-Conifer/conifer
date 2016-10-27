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
    perPage: PropTypes.number,
    defaultSort: PropTypes.object,
    filterable: PropTypes.array,
  }

  static defaultProps = {
    filterFn: null,
    emptyMsg: '0 items',
    perPage: 100,
    defaultSort: null,
    filterable: null,
  }

  constructor(props) {
    super(props);

    this.toggleShowAll = this.toggleShowAll.bind(this);

    this.state = {
      perPage: props.perPage,
    }
  }

  toggleShowAll(evt) {
    evt.preventDefault();

    this.setState({perPage: this.state.perPage?0:this.props.perPage})
  }

  render() {
    const { defaultSort, emptyMsg, filterable, filterFn, items, keys, uniqueKey } = this.props;
    const { perPage } = this.state;

    return (
      <section className='wr-list'>
        <Table
          className='wr-list-table'
          noDataText={emptyMsg}
          itemsPerPage={perPage}
          sortable={filter(keys, 'sortable').map(k => {
            const column=k.label ? k.label:k.id;
            return k.sortFunction ?
              {column, sortFunction: k.sortFunction} :
              column
          })}
          onSort={filterFn}
          defaultSort={defaultSort}
          filterable={filterable}
          filterPlaceholder={filterable?`search by ${filterable.join(', ')}`:''}>
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
                            value={item[key.id]}
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
        {
          items &&
          <a className='show-all' onClick={this.toggleShowAll}>{perPage?'Show All':'Paginate'}</a>
        }
      </section>
    );
  }
}

export default List;
