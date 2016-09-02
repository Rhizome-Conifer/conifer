import React, { Component, PropTypes } from 'react';
import { Button, Col, Form, FormGroup,
         FormControl, HelpBlock, Modal } from 'react-bootstrap';
import sum from 'lodash/sum';

import './style.scss';


class ModalForm extends Component {

  static propTypes = {
    close: PropTypes.func,
    save: PropTypes.func,
    form: PropTypes.array,
    title: PropTypes.string,
    show: PropTypes.bool,
  }

  constructor(props) {
    super(props);

    this.state = {};
    this._close = this._close.bind(this);
    this._save = this._save.bind(this);
    this.validate = this.validate.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.keyPress = this.keyPress.bind(this);
  }

  keyPress(evt) {
    if(evt.keyCode === 27 && this.props.show)
      this._close();
  }

  handleChange(evt) {
    this.setState({[evt.target.name]: evt.target.value});
  }

  validate(item) {
    if(!this.state) return 'success';
    const val = this.state[item.field];
    return item.validate(val) ? 'success' : 'error';
  }

  _close() {
    // wipe state & remove
    this.state = {};
    this.props.close();
  }

  _save(evt) {
    evt.preventDefault();

    const data = this.state;

    // cleanup & close
    this._close();

    /* send back form data */
    this.props.save(data);
  }

  componentWillReceiveProps(nextProps) {
    // read new form props and set default values in the local state
    if(this.props.form !== nextProps.form && nextProps.form) {
      for(let form of nextProps.form){
        if(form.value)
          this.setState({[form.field]: form.value});
      }
    }
  }

  componentDidMount() {
    window.addEventListener('keyup', this.keyPress);
  }

  componentWillUnmount() {
    window.removeEventListener('keyup', this.keyPress);
  }

  formWidgets(item) {
    switch(item.type) {
      case 'text':
        return (
          <FormGroup
            key={item.field}
            controlId={item.field}
            validationState={this.validate(item)}>
              <Col sm={3}>
                {item.label}
              </Col>
              <Col sm={9}>
                <FormControl
                  type={item.type}
                  name={item.field}
                  placeholder={item.placeholder}
                  onChange={this.handleChange} />
                  <HelpBlock>{item.help}</HelpBlock>
              </Col>
          </FormGroup>
        );
      case 'select':
        return (
          <FormGroup
            key={item.field}
            controlId={item.field}>
              <Col sm={3}>
                {item.label}
              </Col>
              <Col sm={9}>
                <FormControl
                  name={item.field}
                  defaultValue={item.value}
                  componentClass='select'
                  placeholder={`select ${item.field}`}
                  onChange={this.handleChange}>
                  {
                    item.values.map((val) => <option key={val} value={val}>{val}</option>)
                  }
                </FormControl>
                <HelpBlock>{item.help}</HelpBlock>
              </Col>
          </FormGroup>
        );
      case 'readOnly':
        return (
          <FormGroup
            key={item.field}
            controlId={item.field}>
              <Col sm={3}>
                {item.label}
              </Col>
              <Col sm={9}>
                <FormControl.Static>
                  {item.value}
                </FormControl.Static>
                <HelpBlock>{item.help}</HelpBlock>
              </Col>
          </FormGroup>
        );
      default:
        return <div />;
    }
  }

  render() {
    const { title, form, show } = this.props;

    if(!form) return <div />;

    const isValid = sum(form.map(i => Number(this.validate(i) === 'success'))) !== form.length;
    const isReadOnly = sum(form.map(i => Number(i.type === 'readOnly'))) === form.length;

    return (
      <Modal show={show} title={title}>
        <Modal.Header>
          <Modal.Title>{title}</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Form onSubmit={this._save} horizontal>
            {
              form && form.map(item => this.formWidgets(item))
            }
            <FormControl.Feedback />
          </Form>
        </Modal.Body>

        <Modal.Footer>
         <Button onClick={this._close}>Cancel</Button>
         <Button bsStyle='primary' disabled={isValid} onClick={this._save}>{isReadOnly?'Confirm':'Save'}</Button>
        </Modal.Footer>
      </Modal>
    );
  }
}

export default ModalForm;
