'use strict';

/**
 * Serverless Swagger Import Plugin
 * - This Serverless plugin imports AWS API Gateway Endpoint
 *   configuration (x-amazon-apigateway-integration extensions)
 *   from a Swagger file to s-function.json.
 */

module.exports = function(ServerlessPlugin, serverlessPath) {

  const path    = require('path'),
    _         = require('lodash'),
    SError    = require(path.join(serverlessPath, 'Error')),
    SCli       = require(path.join(serverlessPath, 'utils/cli')),
    BbPromise = require('bluebird');

  /**
   * ServerlessSwaggerImport
   */

  class ServerlessSwaggerImport extends ServerlessPlugin {

    constructor(S) {
      super(S);
    }

    static getName() {
      return 'com.serverless.' + ServerlessSwaggerImport.name;
    }

    registerActions() {

      this.S.addAction(this.swaggerImport.bind(this), {
        handler:       'swaggerImport',
        description:   'Import endpoint configs from Swagger',
        context:       'swagger',
        contextAction: 'import',
        options:       [{
          option:      'component',
          shortcut:    'c',
          description: 'Component name'
        }],
        parameters: [
          {
            parameter: 'swaggerFilePath',
            description: 'Path to a swagger definition file',
            position: '0'
          }
        ]
      });

      return BbPromise.resolve();
    }

    swaggerImport(evt) {
      const project = this.S.getProject()

      if (!process.cwd().includes(project.getRootPath())) {
        return BbPromise.reject(new SError("You need to run this command inside a Serverless project component"));
      }

      const componentName = evt.options.component || process.cwd().replace(project.getRootPath(), '').split(path.sep)[1];

      if (_.isEmpty(componentName)) {
        return BbPromise.reject(new SError("You need to run this command inside a Serverless project component"));
      }

      evt.data.componentName = componentName;
      evt.data.endpointsUpdated = []

      if (evt.options.swaggerFilePath) {
        if (path.isAbsolute(evt.options.swaggerFilePath)) {
          evt.data.swaggerFilePath = evt.options.swaggerFilePath;
        } else {
          evt.data.swaggerFilePath = path.resolve(process.cwd(), evt.options.swaggerFilePath);
        }
      } else {
        evt.data.swaggerFilePath = path.resolve(this.S.getProject().getRootPath(), componentName, 'swagger.yaml');
      }

      this.evt = evt;

      return this._parseSwagger()
        .bind(this)
        .then(this._updateEndpoints)
        .then((updatedFunctions) => {
          SCli.log(`----------------------------------------------------`);
          SCli.log(`Updated ${evt.data.endpointsUpdated.length} endpoints in ${updatedFunctions.length} functions`);
          evt
        });
    }

    _parseSwagger() {
      let SwaggerParser    = require('swagger-parser'),
          importSwaggerAws = {},
          opts             = {
            validate: {
              schema: false
            }
          };

      return BbPromise.resolve()
        .then(() => SwaggerParser.dereference(this.evt.data.swaggerFilePath, opts))
        .then(data => {
          _.each(data.paths, (apiPath, path) => {
            path = path.slice(1);

            _.each(apiPath, (operation, method) => {
              if (!operation['x-amazon-apigateway-integration']) return;
              method = method.toUpperCase()
              let apigPath = path + '~' + method;

              importSwaggerAws[apigPath] = {
                path,
                method,
                apigPath,
                operation,
                integration: operation['x-amazon-apigateway-integration']
              };
            })
          });
          return importSwaggerAws;
        });
    }

    _updateEndpoints(swaggerData) {
      let project   = this.S.getProject(),
          updateFunctions = [],
          endpoints = project.getAllEndpoints({paths: [this.evt.data.componentName]}),
          updated   = [];

      _.each(swaggerData, (swEp) => {
        let endpoint = _.find(endpoints, {path: swEp.path, method: swEp.method})

        if (endpoint) {
          SCli.log(`Updating "${endpoint.getSPath()}"`);
          endpoint.set(swEp.integration);
          updateFunctions.push(endpoint.getFunction());
          this.evt.data.endpointsUpdated.push(endpoint.getSPath());
        } else {
          SCli.log(`Warning: Can't find an endpoint for "${swEp.apigPath}"`);
        }
      });

      return BbPromise.map(_.uniq(updateFunctions), func => func.save())
    }

  }

  return ServerlessSwaggerImport;
};

