import * as cdk from "@aws-cdk/core";
import * as lambdaNodeJS from "@aws-cdk/aws-lambda-nodejs";
import * as apigateway from "@aws-cdk/aws-apigateway";
import * as cwlogs from "@aws-cdk/aws-logs";

export class EcommerceApiStack extends cdk.Stack {
  readonly urlOutput: cdk.CfnOutput;

  constructor(
    scope: cdk.Construct,
    id: string,
    productsHandler: lambdaNodeJS.NodejsFunction,
    props?: cdk.StackProps
  ) {
    super(scope, id, props);

    const logGroup = new cwlogs.LogGroup(this, "EcommerceApiLogGroup", {
      logGroupName: "EcommerceApiLogGroup",
      removalPolicy: cdk.RemovalPolicy.DESTROY, // em produção, melhor manter
      retention: cwlogs.RetentionDays.ONE_MONTH,
    });

    const api = new apigateway.RestApi(this, "ecommerce-api", {
      restApiName: "Ecommerce Service",
      description: "This is the ecommerce service",
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

    // products

    const productsFunctionIntegration = new apigateway.LambdaIntegration(productsHandler);

    const productsResource = api.root.addResource('products');
    productsResource.addMethod('GET', productsFunctionIntegration);
    productsResource.addMethod('POST', productsFunctionIntegration);

    const productIdResource = productsResource.addResource('{id}');
    productIdResource.addMethod('GET', productsFunctionIntegration);
    productIdResource.addMethod('PUT', productsFunctionIntegration);
    productIdResource.addMethod('DELETE', productsFunctionIntegration);

    // orders
    // events
    // invoices

    this.urlOutput = new cdk.CfnOutput(this, 'url', {
        exportName: 'url',
        value: api.url,
    });

  }
}
