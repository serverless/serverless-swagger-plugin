# Serverless Swagger Import Plugin

**Work in progress. Not ready for use yet.**

This [Serverless](http://serverless.com) plugin imports AWS API Gateway Endpoint configuration (`x-amazon-apigateway-integration` extensions) from a [Swagger](http://swagger.io/) file to `s-function.json`.

## Installation
In your project root, run:

```bash
npm install --save serverless-swagger-import-plugin
```

Add the plugin to `s-project.json`:

```json
"plugins": [
  "serverless-swagger-import-plugin"
]
```

## Usage
In a component root folder, run:

```bash
serverless swagger import
```
By default the command will try load the swagger file (`swagger.yaml` or `swagger.json`) from the component folder. You can also specify a path to a swagger file:

```bash
serverless swagger import path/to/swagger.yaml
```