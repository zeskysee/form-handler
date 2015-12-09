Package.describe({
  name: 'kctang:form-handler',
  version: '0.0.3',
  summary: 'Converts HTML form data to JSON further processing',
  git: 'https://github.com/kctang/form-handler.git',
  documentation: 'README.md'
});

Package.onUse(function (api) {
  api.versionsFrom('1.2.0.2');

  api.use([
    'ecmascript',
    'meteor-base',
    'aldeed:simple-schema@1.3.3'
  ]);
  api.use([
    'templating',
    'reactive-var@1.0.6'
  ], 'client');

  api.imply([
    'aldeed:simple-schema',
    'reactive-var'
  ]);

  api.addFiles([
    'src/form-handler.html',
    'src/form-handler.js',
    'src/form-parser.js'
  ], 'client');

  api.export([
    'FormHandler',
    'FormParser'
  ]);
});

Package.onTest(function (api) {
  api.use('ecmascript');
  api.use('tinytest');
  api.use('kctang:form-handler');

  api.addFiles([
    'test/form-handler.js'
  ]);
});
