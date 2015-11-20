const GET_VALUE = 1;
const SET_VALUE = 2;
const DELETE_VALUE = 3;

class _FormParser {
  parse(form) {
    var self = this;
    var doc = {};

    // input[type=text]
    // input[type=number]
    // input[type=hidden]
    // textarea
    _.each(form.querySelectorAll(
      'input[type=text]:not([disabled]), ' +
      'input[type=number]:not([disabled]), ' +
      'textarea:not([disabled]),' +
      'input[type=hidden]'
    ), function (input) {
      // fields with xaction is special, do not process as normal values
      if (!input.hasAttribute('xaction')) {
        self._setValue(doc, input.name, input.value);
      }
    });

    // checkbox
    _.each(form.querySelectorAll('input[type=checkbox]'), function (input) {
      self._setValue(doc, input.name, input.checked);
    });

    // select
    _.each(form.querySelectorAll('select'), function (select) {
      var value = undefined;

      // add selected options for this field to value
      _.each(select.selectedOptions, function (selectedOption) {
        if (_.isUndefined(value)) {
          // add as simple value
          value = selectedOption.value;
        } else if (_.isArray(value)) {
          // push value to existing array
          value.push(selectedOption.value);
        } else {
          // should be string, create array and add it
          value = [value];
        }
      });

      if (value === '') {
        // if selected value is '', $unset it
        doc['$unset'] = doc['$unset'] || {};
        doc['$unset'][select.name] = '';
      }

      if (value) {
        self._setValue(doc, select.name, value);
      }

    });

    // xaction=remove-element
    parseXactionRemoveElement();

    return doc;

    function parseXactionRemoveElement() {
      // need to sort array elements before deleting value to prevent incorrect array index reference
      var removeElements = [];
      _.each(form.querySelectorAll('input[xaction=remove-element]'), function (input) {
        var val = input.value;
        var idx = val.substring(val.lastIndexOf('.') + 1);
        removeElements.push({idx, val});
      });
      removeElements = removeElements.sort(function (a, b) {
        return b.idx - a.idx;
      });

      // delete value
      _.each(removeElements, function (element) {
        var docFieldName = element.val;

        // --- delete value
        self._deleteValue(doc, docFieldName);

        // --- mark parent field to be $unset if its empty
        var parentField = docFieldName.substring(0, docFieldName.lastIndexOf('.'));
        if (self._getValue(doc, parentField) === undefined) {
          // parentField should be removed from document (mongo)
          doc['$unset'] = doc['$unset'] || {};
          doc['$unset'][parentField] = '';
        }
      });
    }

  }

  _getValue(doc, name) {
    return this._locateValue(doc, name, undefined, GET_VALUE);
  }

  _setValue(doc, name, value) {
    this._locateValue(doc, name, value, SET_VALUE);
  }

  _deleteValue(doc, name) {
    this._locateValue(doc, name, undefined, DELETE_VALUE);
  }

  _locateValue(doc, name, value, action) {
    if (doc === undefined) {
      console.log('Undefined doc when locating value of [' + name + ']');
      debugger;
    }

    var segments = name.split(/\./);

    // track parentObj & parentSegmentName so that we can remove empty array/obj for DELETE_VALUE
    var parentObj = undefined;
    var parentSegmentName = undefined;

    var obj = doc;
    for (var idx = 0; idx < segments.length; idx++) {
      var segment = segments[idx]; // cannot be number
      var nextSegment = segments[idx + 1]; // maybe number
      if (/^\d+$/.test(nextSegment)) {
        idx++;
        // handle as array
        var arr = getArraySegment(obj, segment);

        // set value if this is the last segment
        var arrIdx = Number.parseInt(nextSegment);
        if (idx + 1 >= segments.length) {
          // set value
          if (arr.length < arrIdx + 1) {
            arr.length = arrIdx + 1;
          }
          switch (action) {
            case GET_VALUE:
              return arr[arrIdx];
            case SET_VALUE:
              arr[arrIdx] = value;
              return;
            case DELETE_VALUE:
              arr.splice(arrIdx, 1);
              if (arr.length === 0) {
                delete obj[segment];
              }
              return;
            default:
              throw new Meteor.Error('Unknown action');
          }

        } else {
          parentObj = obj;
          parentSegmentName = segment;
          obj = getArrayElement(arr, arrIdx);
        }

      } else {
        // handle as object

        // set value if this is the last segment
        if (idx + 1 >= segments.length) {
          // set value
          switch (action) {
            case GET_VALUE:
              return obj[segment];
            case SET_VALUE:
              obj[segment] = value;
              return;
            case DELETE_VALUE:
              delete obj[segment];
              if (_.size(obj) === 0 && parentObj !== undefined) {
                delete parentObj[parentSegmentName];
              }
              return;
            default:
              throw new Meteor.Error('Unknown action');
          }

        } else {
          parentObj = obj;
          parentSegmentName = segment;
          obj = getObjectSegment(obj, segment);
        }
      }
    }

    throw new Meteor.Error('Error getting/setting/deleting value [' + name + ']');

    function getArraySegment(obj, segment) {
      var arr = obj[segment];

      if (arr === undefined) {
        arr = [];
        obj[segment] = arr;
      }

      return arr;
    }

    function getArrayElement(arr, idx) {
      if (arr.length < idx + 1) {
        arr.length = idx + 1;
        arr[idx] = {};
      }

      return arr[idx];
    }

    function getObjectSegment(obj, segment) {
      var segmentObj = obj[segment];

      if (segmentObj === undefined) {
        segmentObj = {};
        obj[segment] = segmentObj;
      }

      return segmentObj;
    }
  }
}

FormParser = new _FormParser();
