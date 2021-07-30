import * as cdk from "@aws-cdk/core";
import * as lambdaNodeJS from "@aws-cdk/aws-lambda-nodejs";
import * as apigateway from "@aws-cdk/aws-apigateway";
import * as cwlogs from "@aws-cdk/aws-logs";

export class ECommerceApiStack extends cdk.Stack {
  readonly urlOutput: cdk.CfnOutput;

  constructor(
    scope: cdk.Construct,
    id: string,
    productsHandler: lambdaNodeJS.NodejsFunction,
    props?: cdk.StackProps
  ) {
    super(scope, id, props);

    const logGroup = new cwlogs.LogGroup(this, "ECommerceApiLogs", {
      logGroupName: "ECommerceApi",
    });

    const api = new apigateway.RestApi(this, "ecommerce-api", {
      restApiName: "ECommerce Service",
      description: "This is the ECommerce service",
      deployOptions: {
        accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
          caller: true,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true,
        }),
      },
    });

    const productsFunctionIntegration = new apigateway.LambdaIntegration(
      productsHandler,
      {
        requestTemplates: { "application/json": '{ "statusCode": "200" }' },
      }
    );

    // /products
    const productsResource = api.root.addResource("products");

    //GET /products
    productsResource.addMethod("GET", productsFunctionIntegration);

    //POST /products
    productsResource.addMethod("POST", productsFunctionIntegration);

    // /products/{id}
    const productsIdResource = productsResource.addResource("{id}");

    //GET /products/{id}
    productsIdResource.addMethod("GET", productsFunctionIntegration);

    //PUT /products/{id}
    productsIdResource.addMethod("PUT", productsFunctionIntegration);

    //DELETE /products/{id}
    productsIdResource.addMethod("DELETE", productsFunctionIntegration);

    this.urlOutput = new cdk.CfnOutput(this, "url", {
      exportName: "url",
      value: api.url,
    });

    // /orders
    // /events
    // /invoices
  }
}