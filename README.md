# form-handler

A package that converts form inputs to JSON data for further processing.

Supports:

* Conversion of nested fields into JSON arrays/objects (e.g. customer.name, customer.address.1, customer.address.2). 
* Optional form validation based on simple-schema.
* Optional custom form validation.
* Form parser will create $unset modifiers to remove array/object fields automatically. 
* Multiple form lifecycle callbacks: load(), beforeValidate(), validate(), save().

# Install

...

# Usage

In templates that requires form handling:

    <template name="myForm">
      {{#formHandler}}
        <input type="text" name="pet-name">
      {{/formHandler}}
    </template>

In template's JavaScript file:

    Template.myForm.onCreated(function() {
      FormHandler.add(this, {
        debug: true,
        schema: MySchema,
        load: function() {
          // Called when the form loads. Return an object that represents the initial form values.  
          // "this" contains template data
        },
        beforeValidate(doc) {
          // Called before form validation. This can be used to perform post form submission processing before validation.
          // "this" contains template data
        },
        validate: function(doc) {
          // Specifying this function overrides the default form validation against schema if specified. If you are using
          // schema, you should not need to specify this function.
        },
        save(parsedDoc, modifier) {
          // Called when form passed validation.
          // parsedDoc contains raw field values after parsing the form.
          // modifier contains $set and optionally $unset keys. $set contains a document that passed schema validation. $unset contains any object/arrays that needs to be removed from a document.
        }
      });
    };

