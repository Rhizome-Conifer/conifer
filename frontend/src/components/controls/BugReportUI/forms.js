import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Button, ControlLabel, Form, FormControl, FormGroup } from 'react-bootstrap';

import { product } from 'config';

import { CheckboxField } from './fields';


export class ReportUIBugForm extends Component {
  static propTypes = {
    cb: PropTypes.func
  };

  constructor(props) {
    super(props);

    this.state = {
      desc: '',
      email: ''
    };
  }

  handleInput = (evt) => {
    this.setState({ [evt.target.name]: evt.target.value });
  }

  save = (evt) => {
    evt.preventDefault();

    this.props.cb({
      ...this.state,
      url: window.location.href
    });
  }

  render() {
    return (
      <Form id="uibugform" onSubmit={this.save}>
        <p>Spot something off? Let us know what's happening:</p>
        <FormGroup>
          <FormControl aria-label="description" componentClass="textarea" name="desc" placeholder="When I click the 'save' button when editing my collection description, nothing happens." onChange={this.handleInput} value={this.state.bugReport} />
        </FormGroup>
        <FormGroup>
          <ControlLabel>Email to notify in response to this issue: (optional)</ControlLabel>
          <FormControl aria-label="email" name="email" placeholder="me@example.com" onChange={this.handleInput} value={this.state.email} />
        </FormGroup>
        <Button bsStyle="primary" type="submit" block>Send Report</Button>
      </Form>
    );
  }
}


export class ReportContentBugForm extends Component {
  static propTypes = {
    cb: PropTypes.func,
    route: PropTypes.object
  };

  constructor(props) {
    super(props);

    this.state = {
      desc: '',
      email: ''
    };
  }

  save = (evt) => {
    evt.preventDefault();

    let state = '';
    const regex = new RegExp(/(replay|extract|patch|record)/);

    // determine current mode
    if (this.props.route && this.props.route.name && regex.test(this.props.route.name)) {
      [state] = this.props.route.name.match(regex);
    }

    this.props.cb({
      ...this.state,
      state,
      url: window.location.href
    });
  }

  handleChange = (evt) => {
    if (evt.target.type === 'checkbox') {
      if (evt.target.name in this.state) {
        this.setState({ [evt.target.name]: !this.state[evt.target.name] });
      } else {
        this.setState({ [evt.target.name]: true });
      }
    } else {
      this.setState({ [evt.target.name]: evt.target.value });
    }
  }

  render() {
    const { email, desc } = this.state;
    const fields = [
      { name: 'loading', label: 'Page not loading' },
      { name: 'missing', label: 'Missing content (Images, Video)' },
      { name: 'video', label: 'Video/Audio not playing' },
      { name: 'embed', label: 'Embedded content issues' },
      { name: 'scrolling', label: 'Scrolling issues' },
      { name: 'leak', label: 'Some items not archived, loading from live web' }
    ];

    return (
      <React.Fragment>
        <h4>This Page Doesn't Look Right? Let Us Know!</h4>
        <p>{`Some pages are tricky for ${product} to capture and replay. Our goal is to make it work as best as possible on any page!`}</p>
        <p>{`Please indicate anything that may have gone wrong on this page. Your feedback will help make ${product} better!`}</p>

        <hr />

        <Form id="bugform" onSubmit={this.save}>
          {
            fields.map(
              field => <CheckboxField {...field} key={field.name} cb={this.handleChange} />
            )
          }
          <FormGroup id="formControlTextarea">
            <FormControl
              aria-label="additional info (optional)"
              name="desc"
              onChange={this.handleChange}
              componentClass="textarea"
              value={desc}
              placeholder="Additional Info (optional)" />
          </FormGroup>
          <FormGroup>
            <ControlLabel>Email to notify when this issue is fixed: (optional)</ControlLabel>
            <FormControl
              aria-label="email (optional)"
              id="bugEmail"
              type="email"
              name="email"
              onChange={this.handleChange}
              value={email}
              placeholder="Email" />
          </FormGroup>
          <Button bsStyle="primary" type="submit" block>Send Report</Button>
        </Form>
      </React.Fragment>
    );
  }
}
