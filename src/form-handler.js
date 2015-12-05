/**
 * This class performs form submission and calls form handler methods based on defined lifecycle.
 */
class Form {
  constructor(context, handler = {}) {
    this._context = context;
    this._handler = handler;
    this._doc = new ReactiveVar({});
    this._errors = new ReactiveVar({});

    // set template's data.form as this form object
    if (this._context.data.form !== undefined) {
      // TODO something not right here, need to understand how to handle when form exist in context
      console.debug('Form exist in current data context');
    }
    this._context.data.form = this;

    if (this._handler.load) {
      let doc = this._handler.load.call(this._context.data);
      if (!doc) {
        throw new Meteor.Error(`load() did not return a valid doc object`);
      }
      this.doc(doc);
    }
  }

  doc(doc) {
    if (arguments.length > 0) {
      if (doc === undefined) {
        throw new Error('Cannot set doc as undefined');
      }
      this._doc.set(doc);
    } else {
      return this._doc.get();
    }
  }

  errors(errors) {
    if (arguments.length > 0) {
      if (errors === undefined) {
        throw new Error('Cannot set errors as undefined');
      }
      this._errors.set(errors);
    } else {
      return this._errors.get();
    }
  }

  schema() {
    return this._handler.schema;
  }

  submit(event) {
    'use strict';

    var errors = {};
    var parsedDoc = FormParser.parse(event.target);
    var modifier = {
      $set: JSON.parse(JSON.stringify(parsedDoc)), // TODO: #tip easy way to clone object
      $unset: {}
    };

    if (modifier.$set['$unset']) {
      // if FormParser sets '$unset' in the parsed doc, move the values to modifier.$unset
      modifier.$unset = modifier.$set['$unset'];
      delete modifier.$set['$unset'];
    }

    // --- beforeValidate
    var handler = this._handler;
    handler.beforeValidate && handler.beforeValidate.call(this._context.data, modifier);

    // --- validate
    if (handler.validate) {
      // execute custom validate function defined by handler
      errors = handler.validate.call(this._context.data, modifier);
    } else if (handler.schema) {
      // --- validate with schema
      errors = validateAgainstSchema(modifier, handler.schema);
    }

    this.errors(errors);
    this.doc(modifier.$set);

    if (_.size(this.errors()) === 0) {
      // call handler's save if there is no error
      handler.save && handler.save.call(this._context.data, parsedDoc, modifier);

    } else if (handler.debug === true) {
      console.log(errors);

    }

    function validateAgainstSchema(modifier, schema) {
      var errors = {};

      if (!schema) {
        throw new Error('Cannot validate form without schema');
      }

      //var doc = modifier.$set;
      //extraClean(schema, doc); // code has no use?
      schema.clean(modifier, {
        modifier: true
      });

      var validationContext = schema.namedContext('form-handler');
      validationContext.resetValidation();

      // validate all required fields
      if (!validationContext.validate(modifier, {modifier: true})) {
        // convert array of errors from simple schema into a map (easy to render)
        _.each(validationContext.invalidKeys(), function (obj) {
          errors[obj.name] = _.omit(obj, 'name'); // remove redundant object key
          errors[obj.name].message = schema.messageForError(obj.type, obj.name);
        });
      }

      return errors;

      function extraClean(schema, doc) {
        _.each(schema.objectKeys(), function (key) {
          var type = schema.getDefinition(key).type;

          if (type === Array && typeof doc[key] === 'string') {
            // for single file upload in multi form upload
            // convert String values for [String] types into [String]
            doc[key] = [doc[key]];
          }
        })
      }
    }
  }

  value(name, indexes, value) {
    if (name.indexOf('.$') !== -1) {
      if (indexes === undefined) {
        throw new Error(`Indexes required to resolve [${name}]`);
      }
      name = FormHandler.toIndex(name, indexes);
    }

    if (arguments.length === 3) {
      // set value
      FormParser._setValue(this._doc.get(), name, value);
      // refresh reactive var
      this._doc.set(this._doc.get());
    } else {
      // get value
      return FormParser._getValue(this._doc.get(), name);
    }
  }

  errorMessage(name, indexes) {
    if (name.indexOf('.$') !== -1) {
      if (indexes === undefined) {
        throw new Error(`Indexes required to resolve [${name}]`);
      }
      name = FormHandler.toIndex(name, indexes);
    }

    var error = this._errors.get()[name];
    if (_.isObject(error)) {
      return error.message;
    }

    return '';
  }

  type(name) {
    var type = 'text';

    if (this._handler && this._handler.schema) {
      var prop = this._handler.schema.schema(name);

      if (prop) {
        switch (prop.type) {
          case Number:
            type = 'number';
        }
      }
    }

    return type;
  }

}

Template.formHandler.events({
  'submit form'(event, template) {
    event.preventDefault();

    if (!this.form) {
      throw new Error('Form handler not defined. Did you call FormHandler.add()?');
    }

    this.form.submit(event);
  }
});

FormHandler = {
  _forms: {},

  add(context, handler) {
    if (!context.data) {
      throw new Meteor.Error('Data not defined in context');
    }

    // remove 'Template.' prefix
    var name = context.view.name.substring(9);
    FormHandler._forms[name] = new Form(context, handler);
  },

  // TODO: consider move to form class
  to$(name) {
    return name.replace(/\.\d+/g, '.$');
  },

  // TODO: consider move to form class
  toIndex(name, indexes) {
    if (indexes === undefined) {
      return name;
    } else {
      var currentIdx = 0;
      return name.replace(/\.\$/g, function () {
        if (typeof indexes === 'number') {
          return '.' + indexes;
        } else {
          // got to be array
          return '.' + indexes[currentIdx++];
        }
      });
    }
  }

};
