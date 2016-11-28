import React, { Component, PropTypes } from 'react';
import { Button, ControlLabel, FormControl, FormGroup, Glyphicon } from 'react-bootstrap';
import { Table, Thead, Th, Tr, Td } from 'reactable';

import './style.scss';


class AddRemoveWidget extends Component {

  static propTypes = {
    items: PropTypes.array,
    modified: PropTypes.func,
  }

  constructor(props) {
    super(props);

    this.tagInput = this.tagInput.bind(this);
    this.addTag = this.addTag.bind(this);
    this.removeTag = this.removeTag.bind(this);
    this.state = {
      tags: this.props.items,
      tag: '',
    };
  }

  addTag(evt) {
    if(evt.keyCode === 13 && this.state.tag.length) {
      const tags = this.state.tags;
      tags.push({name:this.state.tag, usage:0});

      this.setState({
        tags: tags,
        tag:'',
      });

      this.props.modified();
    }
  }

  removeTag(index) {
    const tags = this.state.tags;
    tags.splice(index, 1);
    this.setState({
      tags: tags,
    });

    this.props.modified();
  }

  tagInput(evt) {
    evt.preventDefault();

    this.setState({
      tag: evt.target.value
    });
  }

  serialize() {
    return this.state.tags;
  }

  componentWillReceiveProps(nextProps) {
    this.setState({tags: nextProps.items});
  }

  render() {
    const { tags, tag } = this.state;

    return (
      <div>
        <FormGroup controlId='addTag'>
          <ControlLabel>Add Tag:</ControlLabel>
          <FormControl type='text' value={tag} onKeyUp={this.addTag} onChange={this.tagInput} />
        </FormGroup>
        <Table
          className='wr-addRemove-table'
          noDataText='No Tags.'
          itemsPerPage={10}>
          <Thead>
            <Th column='tag'>tag</Th>
            <Th column='remove'/>
          </Thead>
          {
            tags &&
              tags.map(
                (item, idx) =>
                  <Tr key={item.name}>
                    <Td column='tag'>{`${item.name} (${item.usage})`}</Td>
                    <Td column='remove'>
                      <Button bsSize='xsmall' bsStyle='danger' onClick={() => this.removeTag(idx)}>
                        <Glyphicon glyph='remove' />
                      </Button>
                    </Td>
                  </Tr>
              )
          }
        </Table>
      </div>
    );
  }
}

export default AddRemoveWidget;
